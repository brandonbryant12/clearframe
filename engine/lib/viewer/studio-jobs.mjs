// Studio jobs: native stills, section previews, rough cuts, checks, exports and review verbs,
// run as CLI children one at a time behind the heavy gate. Cancellable; results remember the
// working-copy hash they started from, so an edit made meanwhile marks them stale.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkId } from '../store.mjs';

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashOf = dir => sha(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
const CLI = fileURLToPath(new URL('../../cli.mjs', import.meta.url));
const GATE = path.join(os.homedir(), '.local/bin/codex-heavy');
const KEEP_FILES = 60, KEEP_BYTES = 400e6;

/**
 * kind → how to run it. `edits: false` pauses source edits while it runs (it saves a revision or
 * rewrites the working copy); `heavy` goes through the gate; `cache` reuses an identical result.
 */
const KINDS = {
  still: { heavy: true, cache: true, label: j => `Still · ${j.beat ?? `${j.at?.toFixed(2)} s`}` },
  section: { heavy: true, cache: true, label: j => `Section preview · ${j.beats.join(', ')}` },
  check: { heavy: true, label: () => 'Check the working copy' },
  draft: { heavy: true, edits: false, label: () => 'Rough cut (half size)' },
  final: { heavy: true, edits: false, label: () => 'Final render' },
  captions: { heavy: false, label: () => 'Caption files' },
  revise: { heavy: true, edits: false, label: j => `Candidate for ${j.note}` },
  reject: { heavy: true, edits: false, label: j => `Reject ${j.revision}` },
};

export function createStudioJobs({ base, out, onDone = async () => {} }) {
  const jobs = new Map(), queue = [];
  let running = null;
  const store = path.join(out, 'studio');
  const persist = () => { try { fs.mkdirSync(store, { recursive: true }); fs.writeFileSync(path.join(store, 'jobs.json'), JSON.stringify([...jobs.values()].map(view))); } catch {} };
  const view = ({ dir, child, killTimer, ...j }) => j;
  // Jobs from an earlier server run come back as history; anything unfinished was interrupted.
  try {
    for (const j of JSON.parse(fs.readFileSync(path.join(store, 'jobs.json'), 'utf8'))) jobs.set(j.id, ['queued', 'waiting', 'running'].includes(j.status) ? { ...j, status: 'interrupted' } : j);
  } catch {}
  const cache = new Map([...jobs.values()].filter(j => j.status === 'complete' && j.key && j.output && fs.existsSync(j.output)).map(j => [j.key, j]));

  function prune() {
    for (const sub of ['stills', 'sections']) {
      const dir = path.join(store, sub);
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).map(f => path.join(dir, f)).map(f => ({ f, s: fs.statSync(f) })).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
      let bytes = 0;
      files.forEach(({ f, s }, i) => { bytes += s.size; if (i >= KEEP_FILES || bytes > KEEP_BYTES) { fs.rmSync(f, { force: true }); for (const [k, j] of cache) if (j.output === f) cache.delete(k); } });
    }
  }

  function args(j) {
    const rough = j.rough ? ['--rough'] : [];
    if (j.kind === 'still') return ['still', j.dir, ...(j.beat ? ['--beat', j.beat, '--pos', String(j.pos)] : ['--at', String(j.at)]), '--draft', ...rough, '--out', j.output];
    if (j.kind === 'section') return ['preview', j.dir, '--beats', j.beats.join(','), '--handles', String(j.handles), ...rough, '--out', j.output];
    if (j.kind === 'check') return ['check', j.dir, '--draft', ...rough];
    if (j.kind === 'draft') return ['draft', j.dir, ...rough, '--scale', '0.5'];
    if (j.kind === 'final') return ['render', j.dir];
    if (j.kind === 'captions') return ['captions', j.dir, ...(j.draft ? ['--draft'] : [])];
    if (j.kind === 'revise') return ['revise', j.dir, '--note', j.note, '--json'];
    if (j.kind === 'reject') return ['reject', j.dir, j.revision, ...(j.note ? ['--note', j.note] : []), '--by', j.by, '--said', j.said, '--json'];
  }

  function next() {
    if (running || !queue.length) return;
    const j = queue.shift();
    running = j; j.status = 'running'; j.startedAt = new Date().toISOString();
    const gated = KINDS[j.kind].heavy && fs.existsSync(GATE);
    const a = [CLI, ...args(j)];
    // Detached: the child leads its own process group, so cancelling reaches the renderer too.
    const child = spawn(gated ? GATE : process.execPath, gated ? ['--', process.execPath, ...a] : a, {
      cwd: base, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(gated ? { CLEARFRAME_HEAVY_HELD: '1' } : {}), NO_COLOR: '1', FORCE_COLOR: '0' } });
    j.child = child;
    const log = c => {
      const text = c.toString();
      j.log = (j.log + text).slice(-16000);
      const frames = [...text.matchAll(/frames (\d+)\/(\d+)/g)].at(-1);
      if (frames) j.progress = Number(frames[1]) / Math.max(1, Number(frames[2]));
      if (/Waiting for another local build/.test(text)) j.status = 'waiting';
      else if (j.status === 'waiting' && text.trim()) j.status = 'running';
    };
    child.stdout.on('data', log); child.stderr.on('data', log);
    child.once('error', e => { j.log += `\n${e.message}`; });
    child.once('close', async code => {
      clearTimeout(j.killTimer);
      j.finishedAt = new Date().toISOString();
      j.status = j.cancelled ? 'cancelled' : code === 0 ? 'complete' : 'failed';
      // What stopped it, in the engine's words (draft and check list errors as "✗ beat: message").
      if (j.status === 'failed') j.errors = [...j.log.matchAll(/^\s*✗ (.+)$/gm)].map(m => m[1]).slice(0, 12).concat(j.log.match(/^Error: (.+)$/m)?.[1] ?? []).slice(0, 12);
      if (j.status === 'complete') {
        try { finish(j); } catch (e) { j.status = 'failed'; j.log += `\n${e.message}`; }
        try { await onDone(j); } catch (e) { j.log += `\nCould not refresh the studio: ${e.message}`; }
      } else if (j.output) fs.rmSync(j.output, { force: true });
      delete j.child;
      if (running === j) running = null;
      persist(); next();
    });
    persist();
  }

  function finish(j) {
    const now = hashOf(j.dir);
    // A result is only known to show the hash it started from if nothing changed while it ran.
    j.matches = now === j.hash;
    if (j.output) {
      if (!fs.existsSync(j.output)) throw new Error('The job finished without its output.');
      j.url = '/' + path.relative(base, j.output).split(path.sep).map(encodeURIComponent).join('/');
      if (j.matches && j.key) cache.set(j.key, j);
      prune();
    }
    if (j.kind === 'section') {
      // The receipt says which film seconds the preview covers and whether its clock was checked.
      try { const r = JSON.parse(fs.readFileSync(`${j.output}.json`, 'utf8')); j.range = r.range.seconds; j.verified = Array.isArray(r.verified) && r.verified.length > 0; j.hasAudio = !!r.audio; } catch {}
    }
    if (j.kind === 'check') { try { const r = JSON.parse(j.log.slice(j.log.indexOf('{'))); j.result = { errors: r.errors ?? [], warnings: r.warnings ?? [], craft: r.craft ?? [] }; } catch {} }
    const url = f => f && '/' + path.relative(base, path.resolve(base, f)).split(path.sep).map(encodeURIComponent).join('/');
    if (['draft', 'final'].includes(j.kind)) j.revision = /revision (r\d{3,})/.exec(j.log)?.[1] ?? null;
    if (['revise', 'reject'].includes(j.kind)) {
      let r = null;
      try { r = JSON.parse(j.log.slice(j.log.indexOf('{'), j.log.lastIndexOf('}') + 1)); } catch {}
      if (j.kind === 'revise' && r) j.result = { revision: r.revision, page: url(r.page), passages: (r.passages ?? []).map(p => ({ beats: p.beats, before: url(p.before?.output), after: url(p.after?.output) })) };
      if (j.kind === 'reject' && r) j.result = { restored: r.restored ?? [], conflicts: r.conflicts ?? [], now: r.now ?? null, restorePoint: r.restorePoint ?? null };
      j.revision = j.kind === 'revise' ? r?.revision ?? null : j.revision;
    }
    if (j.kind === 'final') j.url = '/' + path.relative(base, path.join(j.dir, 'build/video.mp4')).split(path.sep).map(encodeURIComponent).join('/');
  }

  return {
    /** The job that pauses source edits on this film, if any (queued ones count: their input is the source as it will be). */
    pausing: dir => [running, ...queue].find(j => j && j.dir === dir && KINDS[j.kind].edits === false) ?? null,
    list: film => [...jobs.values()].filter(j => !film || j.film === film).map(view),
    start(dir, body) {
      const { film, kind } = body;
      if (!KINDS[kind]) throw new Error('Unknown studio job.');
      const hash = hashOf(dir);
      if (body.hash != null && body.hash !== hash) throw Object.assign(new Error('Reload the changed working copy before rendering.'), { status: 409 });
      const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
      const rough = sb.beats.some(b => b.placeholder) || body.rough === true;
      const id = crypto.randomUUID();
      const j = { id, film, dir, kind, hash, rough, status: 'queued', log: '', createdAt: new Date().toISOString() };
      if (kind === 'still') {
        if (body.beat != null) {
          if (!sb.beats.some(b => b.id === body.beat)) throw new Error('Choose a scene to preview.');
          j.beat = body.beat; j.pos = Math.min(0.98, Math.max(0, Number(body.pos ?? 0.6)));
        } else {
          j.at = Number(body.at);
          if (!(Number.isFinite(j.at) && j.at >= 0)) throw new Error('Choose a moment to preview.');
        }
        j.key = `${hash}:${j.beat ?? ''}:${j.pos ?? ''}:${j.at ?? ''}:${rough}`;
        j.output = path.join(store, 'stills', `${id}.png`);
      }
      if (kind === 'section') {
        const beats = Array.isArray(body.beats) ? body.beats : [];
        if (!beats.length || beats.some(b => !sb.beats.some(x => x.id === b))) throw new Error('Choose the scenes to preview.');
        j.beats = beats; j.handles = Math.min(3, Math.max(0, Number(body.handles ?? 0.5)));
        j.key = `${hash}:${beats.join(',')}:${j.handles}:${rough}`;
        j.output = path.join(store, 'sections', `${id}.mp4`);
      }
      if (kind === 'captions') j.draft = body.draft !== false;
      if (kind === 'revise') j.note = checkId('note', body.note);
      if (kind === 'reject') {
        j.revision = checkId('revision', body.revision);
        if (body.note) j.note = checkId('note', body.note);
        j.by = String(body.by ?? '').trim().slice(0, 80); j.said = String(body.said ?? '').trim().slice(0, 1000);
        if (!j.by || !j.said) throw new Error('A rejection records who decided and what they said.');
      }
      j.label = KINDS[kind].label(j);
      const hit = j.key && cache.get(j.key);
      if (hit && fs.existsSync(hit.output)) return { id: hit.id, cached: true };
      // The same request already waiting or running: follow it rather than queue a twin.
      const twin = [running, ...queue].find(x => x && x.key && x.key === j.key);
      if (twin) return { id: twin.id };
      if (j.output) fs.mkdirSync(path.dirname(j.output), { recursive: true });
      jobs.set(id, j); queue.push(j);
      while (jobs.size > 40) { const old = [...jobs.values()].find(x => !['queued', 'waiting', 'running'].includes(x.status)); if (!old) break; jobs.delete(old.id); }
      next(); persist();
      return { id };
    },
    cancel(id) {
      const j = jobs.get(id);
      if (!j) throw new Error('No such job.');
      const q = queue.indexOf(j);
      if (q >= 0) { queue.splice(q, 1); j.status = 'cancelled'; j.finishedAt = new Date().toISOString(); persist(); return view(j); }
      if (!j.child) throw new Error('That job is not running.');
      j.cancelled = true;
      try { process.kill(-j.child.pid, 'SIGTERM'); } catch { j.child.kill('SIGTERM'); }
      j.killTimer = setTimeout(() => { try { process.kill(-j.child.pid, 'SIGKILL'); } catch {} }, 8000);
      return view(j);
    },
    /** Stop every child (the server is exiting). */
    stopAll() {
      queue.length = 0;
      for (const j of jobs.values()) if (j.child) { j.cancelled = true; try { process.kill(-j.child.pid, 'SIGTERM'); } catch {} }
      persist();
    },
  };
}
