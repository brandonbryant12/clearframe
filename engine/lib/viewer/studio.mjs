// Studio commands are shared by the browser and local automation. Rendered revisions remain immutable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isRecorded } from '../recording.mjs';
import { validateStoryboard } from '../project.mjs';

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const read = dir => fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8');
const historyFile = dir => path.join(dir, 'review', 'studio-history.json');
const atomic = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); };
const history = dir => { try { return JSON.parse(fs.readFileSync(historyFile(dir), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { entries: [], cursor: 0 }; throw e; } };
export function studioState(dir) {
  const raw = read(dir), h = history(dir), expected = h.cursor ? h.entries[h.cursor - 1]?.after : h.entries[0]?.before;
  const aligned = expected == null || expected === raw;
  return { storyboard: JSON.parse(raw), hash: sha(raw), canUndo: aligned && h.cursor > 0, canRedo: aligned && h.cursor < h.entries.length,
    history: h.entries.map(({ label, at }, i) => ({ label, at, applied: i < h.cursor })), externalChanges: !aligned };
}
export function studioCommand(dir, { hash, command, beat, field, value, direction }) {
  const raw = read(dir);
  if (hash !== sha(raw)) throw new Error('This film changed elsewhere. Reload the working copy before editing.');
  const h = history(dir), before = JSON.parse(raw);
  let after, label;
  if (command === 'undo' || command === 'redo') {
    const state = studioState(dir), undo = command === 'undo';
    if (!(undo ? state.canUndo : state.canRedo)) throw new Error(`Nothing to ${command}.`);
    const item = h.entries[undo ? h.cursor - 1 : h.cursor];
    after = undo ? item.before : item.after; h.cursor += undo ? -1 : 1;
  } else {
    const sb = structuredClone(before), b = sb.beats.find(b => b.id === beat);
    if (command === 'beat.set') {
      if (!b) throw new Error('Scene no longer exists.');
      const fields = ['label', 'duration', 'vo', 'props.text', 'props.title', 'props.support', 'props.kicker', 'props.source'];
      if (!fields.includes(field)) throw new Error('Unsupported scene property.');
      if (field === 'duration') { if (!Number.isFinite(value) || value < .1 || value > 3600) throw new Error('Duration must be between 0.1 and 3600 seconds.'); }
      else if (typeof value !== 'string' || value.length > 20000) throw new Error('Enter text shorter than 20,000 characters.');
      if (field === 'vo') {
        let metadata; try { metadata = JSON.parse(fs.readFileSync(path.join(dir, 'assets', 'vo', `${b.id}.json`), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (isRecorded(metadata)) throw new Error('Recorded speech must be edited through source cuts.');
      }
      if (field.startsWith('props.')) { b.props ??= {}; b.props[field.slice(6)] = value; } else b[field] = value;
      label = `Change ${field.replace('props.', '')} in ${b.label || b.id}`;
    } else if (command === 'beat.move') {
      const i = sb.beats.findIndex(x => x.id === beat), j = i + direction;
      if (i < 0 || ![-1, 1].includes(direction) || j < 0 || j >= sb.beats.length) throw new Error('Cannot move scene there.');
      [sb.beats[i], sb.beats[j]] = [sb.beats[j], sb.beats[i]]; label = `Move ${b.label || b.id}`;
    } else if (command === 'film.set') {
      if (field === 'title' && typeof value === 'string' && value.trim() && value.length < 300) sb.title = value;
      else throw new Error('Unsupported film property.');
      label = 'Rename film';
    } else throw new Error('Unknown studio command.');
    const errors = validateStoryboard(sb); if (errors.length) throw new Error(errors.join('\n'));
    after = JSON.stringify(sb, null, 2) + '\n';
    if (JSON.stringify(sb) === JSON.stringify(before)) return studioState(dir);
    if (studioState(dir).externalChanges) { h.entries = []; h.cursor = 0; }
    h.entries = h.entries.slice(0, h.cursor); h.entries.push({ before: raw, after, label, at: new Date().toISOString() });
    h.entries = h.entries.slice(-80); h.cursor = h.entries.length;
  }
  atomic(path.join(dir, 'storyboard.json'), after); atomic(historyFile(dir), JSON.stringify(h));
  return studioState(dir);
}
export function createStudioJobs({ base, onDone = async () => {} }) {
  const jobs = new Map(); let running = null;
  const cli = fileURLToPath(new URL('../../cli.mjs', import.meta.url));
  return {
    busy: dir => running?.dir === dir,
    list: () => [...jobs.values()].map(({ dir, child, ...j }) => j),
    start(dir, { film, kind = 'still', beat, hash }) {
      if (running) throw new Error('A preview is already running. Wait for it to finish.');
      const state = studioState(dir); if (hash !== state.hash) throw new Error('Reload the changed working copy before rendering.');
      if (!['still', 'draft'].includes(kind)) throw new Error('Unknown preview kind.');
      if (kind === 'still' && !state.storyboard.beats.some(b => b.id === beat)) throw new Error('Choose a scene to preview.');
      const id = crypto.randomUUID(), output = path.join(dir, 'build', 'studio', `${id}.png`);
      const args = kind === 'still' ? [cli, 'still', dir, '--beat', beat, '--draft', '--out', output] : [cli, 'draft', dir, '--rough', '--scale', '0.5'];
      const gate = path.join(os.homedir(), '.local/bin/codex-heavy'), gated = fs.existsSync(gate);
      const j = { id, film, dir, kind, beat, hash, status: 'running', log: '', startedAt: new Date().toISOString() };
      jobs.set(id, j); running = j;
      while (jobs.size > 30) jobs.delete(jobs.keys().next().value);
      const child = spawn(gated ? gate : process.execPath, gated ? ['--', process.execPath, ...args] : args,
        { cwd: base, env: { ...process.env, ...(gated ? { CLEARFRAME_HEAVY_HELD: '1' } : {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
      j.child = child;
      const log = c => { j.log = (j.log + c.toString()).slice(-12000); };
      child.stdout.on('data', log); child.stderr.on('data', log);
      child.once('error', e => { j.log += e.message; j.status = 'failed'; running = null; });
      child.once('close', async code => {
        j.status = code === 0 ? 'complete' : 'failed'; j.finishedAt = new Date().toISOString();
        if (code === 0 && kind === 'still') j.url = '/' + path.relative(base, output).split(path.sep).map(encodeURIComponent).join('/');
        if (code === 0 && kind === 'draft') { try { await onDone(); } catch (e) { j.log += `\nCould not refresh studio: ${e.message}`; } }
        if (running === j) running = null;
      });
      return { id };
    },
  };
}
