// Studio jobs: native stills, section previews, rough cuts, checks, exports and review verbs,
// run as CLI children one at a time behind the heavy gate. Cancellable. A job's inputs are pinned
// when it starts (not when it was queued); a preview is cached only for its project and the exact
// inputs it read, and a result whose inputs changed at any point while it ran is never cached or
// labelled current.
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
const KEEP_FILES = 60, KEEP_BYTES = 400e6, KEEP_JOBS = 60;
const LIBRARY = fileURLToPath(new URL('../../../library', import.meta.url));
const BUILD_STAMP = fileURLToPath(new URL('../../../scene/.cache/build.json', import.meta.url));
// Folders a render writes into or never reads as input.
const SKIP = new Set(['build', 'review', 'node_modules']);
const MAX_INPUT_FILES = 20000;

/**
 * Everything a preview reads, by file identity: the project's files outside build/ and review/
 * (storyboard, narration, recordings, pictures, clips, music, the project library), the built-in
 * and shared libraries, and the renderer's build stamp. Path, size, mtime, ctime and inode: an
 * atomic rewrite (an edit and its undo) changes it even when the content ends up the same. Stats
 * only, never content, so a large project stays cheap; past MAX_INPUT_FILES it is unknown (null)
 * and nothing is cached.
 */
export function inputPrint(dir) {
  const h = crypto.createHash('sha256');
  let n = 0;
  const stat = (label, f) => { const s = fs.statSync(f); h.update(`${label}\0${s.size}\0${s.mtimeMs}\0${s.ctimeMs}\0${s.ino}\n`); };
  const walk = (root, tag, d = root) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (e.name.startsWith('.') || (d === root && SKIP.has(e.name))) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(root, tag, f);
      else { if (++n > MAX_INPUT_FILES) throw new Error('too many input files'); stat(`${tag}:${path.relative(root, f)}`, f); }
    }
  };
  try {
    walk(path.resolve(dir), 'p');
    walk(LIBRARY, 'l');
    if (process.env.CLEARFRAME_LIBRARY) walk(path.resolve(process.env.CLEARFRAME_LIBRARY), 'x');
    if (fs.existsSync(BUILD_STAMP)) stat('renderer', BUILD_STAMP);
  } catch { return null; }
  return h.digest('hex');
}

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

/** `cli` and `gate` default to the real CLI and the heavy-work gate; tests pass a stand-in CLI and gate: null. */
export function createStudioJobs({ base, out, onDone = async () => {}, cli = CLI, gate = GATE, keepJobs = KEEP_JOBS }) {
  const jobs = new Map(), queue = [];
  let running = null;
  const store = path.join(out, 'studio');
  const persist = () => { try { fs.mkdirSync(store, { recursive: true }); fs.writeFileSync(path.join(store, 'jobs.json'), JSON.stringify([...jobs.values()].map(j => ({ ...view(j), dir: j.dir })))); } catch {} };
  const view = ({ dir, child, killTimer, ...j }) => j;
  // Jobs from an earlier server run come back as history; anything unfinished was interrupted.
  try {
    for (const j of JSON.parse(fs.readFileSync(path.join(store, 'jobs.json'), 'utf8'))) jobs.set(j.id, ['queued', 'waiting', 'running'].includes(j.status) ? { ...j, status: 'interrupted' } : j);
  } catch {}
  // key → job. A key names the project, its input print and the request, so identical storyboards in
  // two films never share a preview. Only results whose inputs held still are entered.
  const cache = new Map([...jobs.values()].filter(j => j.status === 'complete' && j.cached && j.key && j.output && fs.existsSync(j.output)).map(j => [j.key, j]));
  const keyOf = j => sha(JSON.stringify([path.resolve(j.dir ?? ''), j.print, j.kind, j.beat ?? null, j.pos ?? null, j.at ?? null, j.beats ?? null, j.handles ?? null, j.rough]));
  const uncache = id => { for (const [k, x] of cache) if (x.id === id) cache.delete(k); };
  /** Forget the oldest finished jobs past the limit, and any cache entry that points at them. */
  function evict() {
    while (jobs.size > keepJobs) {
      const old = [...jobs.values()].find(x => !['queued', 'waiting', 'running'].includes(x.status));
      if (!old) break;
      jobs.delete(old.id); uncache(old.id);
    }
  }
  /** A cached result that is still listed (so the UI can find it) and still on disk. */
  function cached(key) {
    const hit = key && cache.get(key);
    if (!hit) return null;
    if (jobs.get(hit.id) !== hit || !fs.existsSync(hit.output)) { cache.delete(key); return null; }
    return hit;
  }

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

  /**
   * Pin a job to the inputs as they are now. Nothing has read them yet, so a job that waited in the
   * queue renders, and is labelled with, the working copy at its start, not at its request.
   */
  function pin(j) {
    let hash = null;
    try { hash = hashOf(j.dir); } catch {}
    const print = KINDS[j.kind].cache ? inputPrint(j.dir) : null;
    if (hash !== j.hash || (KINDS[j.kind].cache && print !== j.print)) { j.requestedHash ??= j.hash; j.repinned = true; }
    j.hash = hash; j.print = print;
    if (KINDS[j.kind].cache) j.key = print ? keyOf(j) : null;
  }

  function next() {
    if (running || !queue.length) return;
    const j = queue.shift();
    running = j; j.status = 'running'; j.startedAt = new Date().toISOString();
    pin(j);
    const gated = KINDS[j.kind].heavy && !!gate && fs.existsSync(gate);
    const a = [cli, ...args(j)];
    // Detached: the child leads its own process group, so cancelling reaches the renderer too.
    const child = spawn(gated ? gate : process.execPath, gated ? ['--', process.execPath, ...a] : a, {
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
    let now = null;
    try { now = hashOf(j.dir); } catch {}
    // A preview is known to show its pinned inputs only if they held still from its start (including
    // any wait for the gate) to its end; an edit and its undo meanwhile leaves it uncertain.
    j.matches = KINDS[j.kind].cache ? !!j.print && now === j.hash && inputPrint(j.dir) === j.print : now === j.hash;
    if (j.output) {
      if (!fs.existsSync(j.output)) throw new Error('The job finished without its output.');
      j.url = '/' + path.relative(base, j.output).split(path.sep).map(encodeURIComponent).join('/');
      j.cached = !!(j.matches && j.key);
      if (j.cached) cache.set(j.key, j);
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
    list(film) {
      const prints = new Map();
      return [...jobs.values()].filter(j => !film || j.film === film).map(j => {
        const result = view(j);
        if (KINDS[j.kind]?.cache && j.status === 'complete') {
          if (j.dir && !prints.has(j.dir)) prints.set(j.dir, inputPrint(j.dir));
          result.matches = !!(j.matches && j.print && prints.get(j.dir) === j.print && fs.existsSync(j.output));
        }
        return result;
      });
    },
    start(dir, body) {
      const { film, kind } = body;
      if (!KINDS[kind]) throw new Error('Unknown studio job.');
      const hash = hashOf(dir);
      if (body.hash != null && body.hash !== hash) throw Object.assign(new Error('Reload the changed working copy before rendering.'), { status: 409 });
      const print = KINDS[kind].cache ? inputPrint(dir) : null;
      const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
      const rough = sb.beats.some(b => b.placeholder) || body.rough === true;
      const id = crypto.randomUUID();
      const j = { id, film, dir, kind, hash, print, rough, status: 'queued', log: '', createdAt: new Date().toISOString() };
      if (kind === 'still') {
        if (body.beat != null) {
          if (!sb.beats.some(b => b.id === body.beat)) throw new Error('Choose a scene to preview.');
          j.beat = body.beat; j.pos = Math.min(0.98, Math.max(0, Number(body.pos ?? 0.6)));
        } else {
          j.at = Number(body.at);
          if (!(Number.isFinite(j.at) && j.at >= 0)) throw new Error('Choose a moment to preview.');
        }
        j.key = print ? keyOf(j) : null;
        j.output = path.join(store, 'stills', `${id}.png`);
      }
      if (kind === 'section') {
        const beats = Array.isArray(body.beats) ? body.beats : [];
        if (!beats.length || beats.some(b => !sb.beats.some(x => x.id === b))) throw new Error('Choose the scenes to preview.');
        j.beats = beats; j.handles = Math.min(3, Math.max(0, Number(body.handles ?? 0.5)));
        j.key = print ? keyOf(j) : null;
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
      const hit = cached(j.key);
      if (hit) return { id: hit.id, cached: true };
      // The same request for the same project and inputs, still queued: follow it rather than queue a
      // twin. (A running one may already be reading inputs that have since changed: queue anew.)
      const twin = j.key && queue.find(x => x.key === j.key);
      if (twin) return { id: twin.id };
      if (j.output) fs.mkdirSync(path.dirname(j.output), { recursive: true });
      jobs.set(id, j); queue.push(j);
      evict();
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
