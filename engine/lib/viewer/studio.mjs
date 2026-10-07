// Studio commands, shared by the browser and local automation (`clearframe studio`).
// Every edit is a validated transaction on storyboard.json with persisted undo; the engine's
// own job builder checks each candidate before it is written. Rendered revisions stay immutable.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonical, withLock, reviewPath } from '../store.mjs';
import { validateStoryboard, loadStoryboard, PRESETS, DEFAULTS } from '../project.mjs';
import { computeTiming, assetSrc } from '../timing.mjs';
import { isRecorded, cutWords, uncut, splitBeat, mergeBeats } from '../recording.mjs';
import { wordKey } from '../word-timing.mjs';
import { listRevisions } from '../revisions.mjs';
import { createJob } from '../../../film/job.mjs';
import { BLOCKS, blockByName, TRANSITIONS, BACKDROPS, MOTIONS } from '../../../film/catalog.mjs';
import { ENTERS, EXITS, COLOR_TOKENS, ELEMENT_TYPES } from '../../../film/canvas.mjs';
import { items } from '../../../film/library.mjs';
import { applyTreatment } from '../../../film/treatments.mjs';
import { sketch, sketchPreset } from '../../../film/sketches.mjs';
import { ICONS } from '../../../film/icons.mjs';
import { storyboardFor } from '../../../film/playbooks.mjs';
import { compilePlan } from '../../../scene/compile.mjs';
import { LENS_KEYS, LENS_GRADES } from '../../../film/constants.mjs';
import { textBox, FONT_FILES } from './clearframe.mjs';
import { ROOT } from './media.mjs';

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const read = dir => fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8');
const same = (a, b) => { try { return canonical(JSON.parse(a)) === canonical(JSON.parse(b)); } catch { return a === b; } };
const historyFile = dir => reviewPath(dir, 'studio-history.json');
const atomic = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); };
const HISTORY_BYTES = 8e6;
const stringify = sb => JSON.stringify(sb, null, 2) + '\n';
const fail = message => { const e = new Error(message); e.status = 400; return e; };

// ------------------------------------------------------------------ history

/** Undo history, repaired if a write was interrupted between the history and the storyboard. */
function loadHistory(dir, raw) {
  let h;
  try { h = JSON.parse(fs.readFileSync(historyFile(dir), 'utf8')); } catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) h = null; else throw e; }
  if (!h || !Array.isArray(h.entries) || !Number.isInteger(h.cursor)) h = { entries: [], cursor: 0 };
  h.cursor = Math.max(0, Math.min(h.cursor, h.entries.length));
  // The history is written first: if the storyboard write never landed, the newest step did not happen.
  const last = h.entries[h.cursor - 1];
  if (last && !same(last.after, raw) && same(last.before, raw)) { h.entries.splice(h.cursor - 1); h.cursor--; }
  return h;
}
const expected = h => (h.cursor ? h.entries[h.cursor - 1]?.after : h.entries[0]?.before);
const aligned = (h, raw) => expected(h) == null || same(expected(h), raw);
function trim(h) {
  h.entries = h.entries.slice(-80);
  while (h.entries.length > 1 && h.entries.reduce((n, e) => n + (e.before?.length ?? 0) + (e.after?.length ?? 0), 0) > HISTORY_BYTES) h.entries.shift();
  h.cursor = Math.min(h.cursor, h.entries.length);
}

// ------------------------------------------------------------------ narration

const voMeta = (dir, id) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'assets', 'vo', `${id}.json`), 'utf8')); } catch { return null; } };
/** How a beat's narration may be edited: master recordings by source cuts, per-beat imports not at all. */
export function narrationOf(dir, b) {
  const meta = b.vo ? voMeta(dir, b.id) : null;
  if (isRecorded(meta)) return { kind: 'recording', editable: false, cuts: (meta.source.removed ?? []).filter(r => r.id !== 'gap').map(r => ({ id: r.id, words: r.words, seconds: r.to - r.from })) };
  if (meta?.provider === 'imported') return { kind: 'imported', editable: false };
  if (!b.vo) return { kind: 'none', editable: true };
  return { kind: meta ? 'voice' : 'script', editable: true, provider: meta?.provider ?? null, measured: meta?.alignment?.kind === 'measured' };
}

// ------------------------------------------------------------------ validation and analysis

/** Assets and plates a stage or block names, resolved the way prepare does (no copying). */
function stageCallbacks(dir, sb) {
  const assetFile = (ref, kind, where) => {
    if (ref.file) return ref.file;
    const a = (sb.assets ?? []).find(x => x.id === ref.asset);
    const rel = a && assetSrc(dir, a);
    if (!rel) throw new Error(`${where}: asset ${ref.asset} is missing`);
    return rel;
  };
  const stage = (rel, where) => {
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) throw new Error(`${where}: ${rel} must exist inside the project`);
    return { file, key: rel };
  };
  return { assetFile, stage };
}

const analyses = new Map();
/** Timing, the engine's job checks and pickable text boxes for a storyboard (cached by content). */
/** Narration files change without the storyboard changing (a draft voice, an alignment): they key the analysis too. */
function voStamp(dir) {
  const vo = path.join(dir, 'assets', 'vo');
  try { return fs.readdirSync(vo).filter(f => f.endsWith('.json')).map(f => fs.statSync(path.join(vo, f)).mtimeMs).reduce((a, b) => Math.max(a, b), 0); } catch { return 0; }
}
export function analyse(dir, sb, raw = stringify(sb)) {
  const key = `${dir}\0${sha(raw)}\0${voStamp(dir)}`;
  if (analyses.has(key)) return analyses.get(key);
  const out = { errors: [], warnings: [], timing: null, boxes: {} };
  let timing, loaded, job;
  try { loaded = loadStoryboard(dir, sb); timing = computeTiming(dir, { storyboard: sb }); }
  catch (e) { out.errors.push(e.message); }
  if (timing) {
    out.timing = {
      duration: timing.duration, fps: timing.fps, width: timing.width, height: timing.height, frames: timing.frames, estimated: timing.estimated,
      beats: timing.beats.map(b => ({ id: b.id, start: b.start, end: b.end, dur: b.dur, chapter: b.chapter,
        vo: b.vo && { start: b.vo.start, end: b.vo.end, estimated: b.vo.estimated, wordTiming: b.vo.wordTiming, provider: b.vo.provider, stale: b.vo.stale ?? null,
          words: b.vo.words.map((w, k) => ({ w: w.w, t0: w.t0, t1: w.t1, k })) } })),
    };
    try { ({ job, errors: out.errors, warnings: out.warnings } = createJob(loaded, timing, { draft: true })); }
    catch (e) { out.errors.push(e.message); }
  }
  if (job && !out.errors.length && (sb.beats.some(b => b.block === 'stage' || b.stage) || sb.stages)) {
    try { out.warnings.push(...compilePlan({ root: dir, sb: loaded, timing, job, ...stageCallbacks(dir, loaded) }, { rough: true }).warnings); }
    catch (e) { out.errors.push(e.message); }
  }
  // Text the picture can be picked by: canvas text elements, mapped back to their authored element.
  for (const jb of job?.beats ?? []) {
    const authored = sb.beats.find(b => b.id === jb.id)?.props?.elements ?? [];
    const list = [];
    (jb.props?.elements ?? []).forEach((el, i) => {
      if (el.type !== 'text' || !String(el.text ?? el.count?.to ?? '').trim()) return;
      let k = el.id != null ? authored.findIndex(a => a.id === el.id) : -1;
      if (k < 0 && authored.length === jb.props.elements.length && authored[i]?.type === 'text') k = i;
      list.push({ text: el.count ? `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}` : String(el.text), box: textBox(el).map(Math.round), at: el.at ?? 0,
        path: k >= 0 ? `props.elements.${k}` : null });
    });
    if (list.length) out.boxes[jb.id] = list;
  }
  analyses.set(key, out);
  while (analyses.size > 24) analyses.delete(analyses.keys().next().value);
  return out;
}

/** Errors a candidate adds that the working copy did not already have. */
function newErrors(dir, before, after) {
  const was = new Set(analyse(dir, before).errors);
  return analyse(dir, after).errors.filter(e => !was.has(e));
}

/** What changed since the newest watchable revision: beats, order and film-wide settings. */
export function changesSince(dir, sb) {
  const r = listRevisions(dir).filter(x => (x.videos ?? []).some(v => v.retained !== false)).at(-1);
  if (!r?.inputs?.['storyboard.json']) return null;
  let old;
  try { old = JSON.parse(fs.readFileSync(path.join(dir, r.inputs['storyboard.json']), 'utf8')); } catch { return null; }
  const film = s => canonical({ ...s, beats: undefined, title: undefined });
  const before = new Map(old.beats.map(b => [b.id, canonical(b)]));
  const ids = sb.beats.map(b => b.id), oldIds = old.beats.map(b => b.id).filter(id => ids.includes(id));
  return { revision: r.id, film: film(old) !== film(sb), added: ids.filter(id => !before.has(id)), removed: old.beats.map(b => b.id).filter(id => !ids.includes(id)),
    edited: sb.beats.filter(b => before.has(b.id) && before.get(b.id) !== canonical(b)).map(b => b.id),
    reordered: canonical(oldIds) !== canonical(ids.filter(id => before.has(id))) };
}

// ------------------------------------------------------------------ state

export function studioState(dir) {
  const raw = read(dir), sb = JSON.parse(raw), h = loadHistory(dir, raw), ok = aligned(h, raw);
  const at = h.entries[h.cursor - 1], next = h.entries[h.cursor];
  const a = analyse(dir, sb, raw);
  return {
    storyboard: sb, hash: sha(raw),
    canUndo: ok && h.cursor > 0 && at?.undo !== false, canRedo: ok && h.cursor < h.entries.length && next?.redo !== false,
    undoLabel: ok && at ? at.label : null, redoLabel: ok && next ? next.label : null,
    history: h.entries.map(({ label, at, kind, by, run }, i) => ({ label, at, kind: kind ?? 'edit', by: by ?? 'person', run: run ?? null, applied: i < h.cursor })), externalChanges: !ok,
    timing: a.timing, errors: a.errors, warnings: a.warnings, boxes: a.boxes,
    narration: Object.fromEntries(sb.beats.map(b => [b.id, narrationOf(dir, b)])),
    changes: changesSince(dir, sb),
  };
}

// ------------------------------------------------------------------ edits

const SAFE = /^(?:[A-Za-z_][\w-]*|\d+)$/, BAD = new Set(['__proto__', 'constructor', 'prototype']);
const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/storyboard.schema.json'), 'utf8'));
const BEAT_KEYS = new Set(Object.keys(SCHEMA.properties.beats.items.properties).filter(k => !['id', 'block'].includes(k)).concat('placeholder', 'speaker', 'stage'));
const FILM_KEYS = new Set(Object.keys(SCHEMA.properties).filter(k => !['$schema', 'version', 'beats', 'assets', 'speakers', 'continuity'].includes(k)).concat('stages'));
const touchesBudget = op => ['set', 'film.set'].includes(op?.command) && (op.target ?? (op.beat == null ? 'film' : 'beat')) === 'film' && String(op.path ?? op.field ?? '').split('.')[0] === 'budget';
function parts(p) {
  const list = String(p ?? '').split('.');
  if (!p || list.some(x => !SAFE.test(x) || BAD.has(x))) throw fail(`Unsupported property path “${p}”.`);
  return list;
}
function checkValue(value) {
  if (value === undefined) return;
  const json = JSON.stringify(value);
  if (json == null || json.length > 200000) throw fail('That value is too large or not JSON.');
  JSON.parse(json, (k, v) => { if (BAD.has(k)) throw fail('Unsupported key.'); if (typeof v === 'string' && v.length > 20000) throw fail('Enter text shorter than 20,000 characters.'); return v; });
}
/** Set (or with null, remove) one value at a dotted path; array indices remove by splicing. */
function setAt(obj, list, value) {
  let o = obj;
  for (let i = 0; i < list.length - 1; i++) {
    const k = list[i];
    if (o[k] == null) { if (value == null) return; o[k] = /^\d+$/.test(list[i + 1]) ? [] : {}; }
    if (typeof o[k] !== 'object') throw fail(`${list.slice(0, i + 1).join('.')} is not an object.`);
    o = o[k];
  }
  const last = list.at(-1);
  if (Array.isArray(o) && !/^\d+$/.test(last)) throw fail('Use an index to change a list.');
  if (Array.isArray(o) && Number(last) > o.length) throw fail('That list is shorter.');
  if (value == null) { if (Array.isArray(o)) o.splice(Number(last), 1); else delete o[last]; }
  else o[last] = structuredClone(value);
}
const uniqueId = (sb, base) => { const stem = String(base).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'scene'; let id = stem, n = 2; while (sb.beats.some(b => b.id === id)) id = `${stem}-${n++}`; return id; };
const nameOf = b => b.label || b.props?.title || b.props?.text || b.id;
const short = s => { s = String(s ?? ''); return s.length > 40 ? `${s.slice(0, 38)}…` : s; };

/** Apply one operation to a storyboard copy; returns its history label. */
function applyOp(dir, sb, op) {
  const beatOf = id => { const b = sb.beats.find(x => x.id === id); if (!b) throw fail('That scene no longer exists.'); return b; };
  const { command } = op;
  if (command === 'set' || command === 'beat.set' || command === 'film.set') {
    const target = op.target ?? (command === 'film.set' || op.beat == null ? 'film' : 'beat'), p = parts(op.path ?? op.field);
    const value = op.value === undefined ? null : op.value;
    checkValue(value);
    if (target === 'film') {
      if (!FILM_KEYS.has(p[0])) throw fail(`The studio does not edit “${p[0]}” for the whole film.`);
      if (p[0] === 'title' && (typeof value !== 'string' || !value.trim() || value.length > 300)) throw fail('A film needs a title shorter than 300 characters.');
      if (p[0] === 'budget' && (p.length > 1 || (value != null && !(Number.isFinite(value) && value >= 0 && value <= 1000)))) throw fail('The film budget is an amount in dollars between 0 and 1000 (empty for none).');
      setAt(sb, p, value);
      return `${value == null ? 'Clear' : 'Set'} film ${p.join(' ')}`;
    }
    const b = beatOf(op.beat), name = short(nameOf(b));
    if (!BEAT_KEYS.has(p[0])) throw fail(`The studio does not edit “${p[0]}” on a scene.`);
    if (p[0] === 'props' && p.length > 1 && b.block !== 'stage' && blockByName(b.block) && !(p[1] in blockByName(b.block).props))
      throw fail(`A ${b.block} scene has no “${p[1]}” property.`);
    if (p[0] === 'vo') {
      const n = narrationOf(dir, b);
      if (n.kind === 'recording') throw fail('This narration is the recording itself: select words in the narration lane and cut them instead.');
      if (n.kind === 'imported') throw fail('This narration was imported with its audio; re-import it with `speech` to change the words.');
      if (value != null && typeof value !== 'string') throw fail('Narration is text.');
    }
    if (p[0] === 'duration' && value != null && !(Number.isFinite(value) && value >= 0.1 && value <= 3600)) throw fail('Duration must be between 0.1 and 3600 seconds.');
    if (p[0] === 'label' && value != null && (typeof value !== 'string' || value.length > 40)) throw fail('A scene label is up to 40 characters.');
    setAt(b, p, value);
    return `${value == null ? 'Clear' : 'Change'} ${p.filter(x => !/^\d+$/.test(x) && x !== 'props').join(' ')} in ${name}`;
  }
  if (command === 'move' || command === 'beat.move') {
    const i = sb.beats.findIndex(x => x.id === op.beat);
    const j = op.to ?? i + op.direction;
    if (i < 0 || !Number.isInteger(j) || j < 0 || j >= sb.beats.length) throw fail('Cannot move the scene there.');
    const [b] = sb.beats.splice(i, 1); sb.beats.splice(j, 0, b);
    return `Move ${short(nameOf(b))}`;
  }
  if (command === 'insert') {
    const i = op.after == null ? sb.beats.length : sb.beats.findIndex(x => x.id === op.after) + 1;
    if (op.after != null && i === 0) throw fail('That scene no longer exists.');
    // A chosen id lets later operations in the same batch fill the new scene.
    if (op.id != null && (typeof op.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(op.id))) throw fail('A scene id is lowercase letters, digits and dashes (up to 40).');
    if (op.id != null && sb.beats.some(x => x.id === op.id)) throw fail(`There is already a scene “${op.id}”.`);
    let beat;
    if (op.sketch) {
      const f = sb.format ?? {}, preset = PRESETS[f.preset] ?? PRESETS.landscape;
      const props = sketch(op.sketch, sketchPreset(f.width ?? preset.width, f.height ?? preset.height));
      if (props.layer) throw fail(`${op.sketch} is scenery: add it to a scene as background art instead.`);
      beat = { id: op.id ?? uniqueId(sb, op.sketch), block: 'canvas', label: short(op.sketch), duration: 6, props };
    } else {
      const meta = blockByName(op.block);
      if (!meta) throw fail(`No native block “${op.block}”.`);
      // A new scene is silent and six seconds long (kinetic type needs words to follow), until you write its narration.
      beat = { id: op.id ?? uniqueId(sb, op.block), block: op.block, label: short(meta.name[0].toUpperCase() + meta.name.slice(1)),
        ...(op.block === 'kinetic' ? { vo: 'Write the line these words follow.' } : { duration: 6 }), props: structuredClone(meta.example) };
      // Catalog examples carry the sample-source line; numbers need a matching sources entry to render.
      if (meta.example.source && !(sb.sources ?? []).some(s => s.title === meta.example.source)) sb.sources = [...(sb.sources ?? []), { id: uniqueSource(sb), title: meta.example.source }];
    }
    sb.beats.splice(i, 0, beat);
    op.created = beat.id;
    return `Add ${op.sketch ? `${op.sketch} drawing` : `${op.block} scene`}`;
  }
  if (command === 'duplicate') {
    const b = beatOf(op.beat), n = narrationOf(dir, b);
    if (['recording', 'imported'].includes(n.kind)) throw fail('A recorded passage plays once; duplicate the picture into a new scene without narration instead.');
    const copy = { ...structuredClone(b), id: uniqueId(sb, `${b.id}-copy`) };
    sb.beats.splice(sb.beats.indexOf(b) + 1, 0, copy);
    op.created = copy.id;
    return `Duplicate ${short(nameOf(b))}`;
  }
  if (command === 'delete') {
    const b = beatOf(op.beat), n = narrationOf(dir, b);
    if (sb.beats.length < 2) throw fail('A film keeps at least one scene.');
    if (n.kind === 'recording') throw fail('This scene plays the recording: cut its words (the scene goes when its last word does) so the cut can be undone exactly.');
    sb.beats.splice(sb.beats.indexOf(b), 1);
    return `Delete ${short(nameOf(b))}`;
  }
  if (command === 'playbook') {
    // Start the film over from a playbook that fits its material: the playbook's scenes (sample
    // content, cited as such) and look, keeping this film's title, format, voice and sources.
    if (sb.beats.some(b => ['recording', 'imported'].includes(narrationOf(dir, b).kind)))
      throw fail('This film plays recorded narration and its scenes follow the recording; a playbook cannot replace them.');
    let fresh;
    try { fresh = storyboardFor(String(op.id ?? ''), { title: sb.title, vertical: sb.format?.preset === 'vertical' }); }
    catch { throw fail(`No playbook “${op.id}”. clearframe_catalog topic playbooks lists them.`); }
    sb.beats = fresh.beats;
    for (const k of ['theme', 'type', 'motion', 'transition', 'backdrop', 'texture', 'lens', 'camera', 'heading', 'textMotion'])
      if (fresh[k] !== undefined) sb[k] = fresh[k]; else delete sb[k];
    const ids = new Set((sb.sources ?? []).map(s => s.id));
    sb.sources = [...(sb.sources ?? []), ...(fresh.sources ?? []).filter(s => !ids.has(s.id))];
    // A film stage spans the scenes it was drawn for; those scenes are gone, so it goes with them.
    const beats = new Set(sb.beats.map(b => b.id)), stages = (sb.stages ?? []).filter(s => beats.has(s.from) && beats.has(s.to));
    const dropped = (sb.stages ?? []).length - stages.length;
    if (stages.length) sb.stages = stages; else delete sb.stages;
    return `Start from the ${op.id} playbook${dropped ? ` (removing ${dropped} stage${dropped > 1 ? 's' : ''} drawn for the old scenes)` : ''}`;
  }
  if (command === 'treatment') {
    const recording = sb.beats.some(b => narrationOf(dir, b).kind === 'recording');
    applyTreatment(sb, op.id, { recording });
    return `Apply the ${op.id} treatment`;
  }
  throw fail('Unknown studio command.');
}
const uniqueSource = sb => { let n = 1; while ((sb.sources ?? []).some(s => s.id === `sample${n > 1 ? n : ''}`)) n++; return `sample${n > 1 ? n : ''}`; };

/** Refuse fast when another process (a CLI cut, a revise) holds the project's review lock. */
function locked(dir, fn) {
  const lock = reviewPath(dir, '.lock');
  try {
    const owner = Number(fs.readFileSync(lock, 'utf8'));
    if (owner && owner !== process.pid) { try { process.kill(owner, 0); throw Object.assign(new Error(`Another ClearFrame command (process ${owner}) is changing this film. Try again in a moment.`), { status: 409 }); } catch (e) { if (e.status) throw e; } }
  } catch (e) { if (e.status) throw e; }
  return withLock(dir, fn);
}

/**
 * Run a studio command against the hash the client last saw; returns the new state. `actor` marks
 * who made the change (an agent run is `{ by: 'agent', run }`) so its steps can be undone together.
 */
export function studioCommand(dir, body, { actor = null } = {}) {
  return locked(dir, () => {
    const raw = read(dir);
    if (body.hash !== sha(raw)) throw Object.assign(new Error('This film changed elsewhere. Reload the working copy before editing.'), { status: 409 });
    const h = loadHistory(dir, raw), ok = aligned(h, raw);
    const { command } = body;
    if (command === 'undo' || command === 'redo') return step(dir, h, ok, command === 'undo');
    if (command === 'undoRun') return undoRun(dir, h, ok, body.run);
    if (command?.startsWith('recording.')) return recordingCommand(dir, h, ok, raw, body);
    const sb = JSON.parse(raw), ops = command === 'batch' ? body.ops : [body];
    // The spending ceiling is the person's to set: an agent's edit may not raise or remove it.
    if (actor?.by === 'agent' && Array.isArray(ops) && ops.some(touchesBudget)) throw fail('Only a person can change the film budget (clearframe studio DIR set budget N).');
    if (!Array.isArray(ops) || !ops.length || ops.length > 200) throw fail('A batch holds 1–200 changes.');
    const labels = ops.map(op => { if (op?.command === 'batch' || op?.command?.startsWith?.('recording.') || ['undo', 'redo'].includes(op?.command)) throw fail('That command cannot be batched.'); return applyOp(dir, sb, op); });
    const errors = validateStoryboard(sb);
    // The renderer's own limit on declared stand-ins (checked there only for rough cuts).
    for (const b of sb.beats) if (b.placeholder != null && !(typeof b.placeholder === 'string' ? b.placeholder.trim() && b.placeholder.length <= 140 : typeof b.placeholder?.text === 'string' && b.placeholder.text.length <= 140))
      errors.push(`${b.id}: placeholder must be a description up to 140 characters (or {text})`);
    if (errors.length) throw fail(errors.join('\n'));
    if (canonical(sb) === canonical(JSON.parse(raw))) return { ...studioState(dir), created: ops.map(o => o.created).filter(Boolean) };
    const added = newErrors(dir, JSON.parse(raw), sb);
    if (added.length) throw Object.assign(fail(`Not saved — the engine would refuse this:\n${added.slice(0, 4).join('\n')}`), { errors: added });
    const after = stringify(sb);
    if (!ok) { h.entries = []; h.cursor = 0; }
    h.entries = h.entries.slice(0, h.cursor);
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 120) : labels.length === 1 ? labels[0] : `${labels.length} changes`;
    h.entries.push({ before: raw, after, label, at: new Date().toISOString(), kind: 'edit', ...(actor ? { by: actor.by, run: actor.run ?? null } : {}) });
    h.cursor = h.entries.length; trim(h);
    atomic(historyFile(dir), JSON.stringify(h));
    atomic(path.join(dir, 'storyboard.json'), after);
    return { ...studioState(dir), created: ops.map(o => o.created).filter(Boolean) };
  });
}

/** Apply operations to a copy, without validating or writing: what a batch would change. */
export function planOps(dir, ops) {
  const raw = read(dir), after = JSON.parse(raw);
  if (!Array.isArray(ops) || !ops.length || ops.length > 200) throw fail('A batch holds 1–200 changes.');
  for (const op of ops) { if (!op || typeof op !== 'object' || ['batch', 'undo', 'redo', 'undoRun'].includes(op.command) || String(op.command ?? '').startsWith('recording.')) throw fail('That command cannot be batched.'); applyOp(dir, after, structuredClone(op)); }
  return { before: JSON.parse(raw), after, hash: sha(raw) };
}

function step(dir, h, ok, undo) {
  if (!ok) throw fail(`Nothing to ${undo ? 'undo' : 'redo'}: the film was changed outside the studio.`);
  const item = h.entries[undo ? h.cursor - 1 : h.cursor];
  if (!item || item[undo ? 'undo' : 'redo'] === false) throw fail(`Nothing to ${undo ? 'undo' : 'redo'}.`);
  if (item.kind === 'recording') {
    // Recorded speech is rebuilt from the master: undo is the engine's exact uncut, redo cuts the same words again.
    if (undo) uncut(dir, { id: item.edit }, { by: item.by });
    else { const r = cutWords(dir, { source: item.words, label: 'Those words' }, { by: item.by }); item.edit = r.id; }
    const now = read(dir);
    if (undo) item.before = now; else item.after = now;
    h.cursor += undo ? -1 : 1;
    atomic(historyFile(dir), JSON.stringify(h));
    return studioState(dir);
  }
  h.cursor += undo ? -1 : 1;
  atomic(historyFile(dir), JSON.stringify(h));
  atomic(path.join(dir, 'storyboard.json'), undo ? item.before : item.after);
  return studioState(dir);
}

/** Undo every step one agent run made, as one change, when they are the newest steps. */
function undoRun(dir, h, ok, run) {
  if (!ok) throw fail('Nothing to undo: the film was changed outside the studio.');
  if (typeof run !== 'string' || !run) throw fail('Name the run to undo.');
  let i = h.cursor;
  while (i > 0 && h.entries[i - 1].run === run && (h.entries[i - 1].kind ?? 'edit') === 'edit') i--;
  if (i === h.cursor) {
    if (h.entries.slice(0, h.cursor).some(e => e.run === run)) throw fail('Later edits came after that run: undo them first, or undo its steps one by one.');
    throw fail('That run made no edits that are still applied.');
  }
  const first = h.entries[i];
  h.cursor = i;
  atomic(historyFile(dir), JSON.stringify(h));
  atomic(path.join(dir, 'storyboard.json'), first.before);
  return studioState(dir);
}

/** Cuts, splits and merges of an imported recording, through the engine's source-edit tools. */
function recordingCommand(dir, h, ok, raw, body) {
  const name = typeof body.by === 'string' ? body.by.trim().slice(0, 80) : '';
  if (!name) throw fail('Recording edits record who asked for them: enter your name.');
  const by = { role: 'human', name };
  const sb = JSON.parse(raw), b = sb.beats.find(x => x.id === body.beat);
  if (!b) throw fail('That scene no longer exists.');
  if (narrationOf(dir, b).kind !== 'recording') throw fail('This scene does not replay the source recording.');
  let entry;
  if (body.command === 'recording.cut') {
    const to = body.to ?? { beat: b.id, k: body.k };
    const sel = { from: { beat: b.id, k: body.from?.k ?? body.k }, to: { beat: to.beat ?? b.id, k: to.k } };
    if (![sel.from.k, sel.to.k].every(Number.isInteger)) throw fail('Select the words to cut.');
    const report = cutWords(dir, sel, { by, dryRun: !!body.dryRun });
    if (body.dryRun) return { plan: { words: report.words, seconds: report.seconds, beats: report.beats.map(p => ({ beat: p.beat, deleted: !!p.deleted })) } };
    entry = { kind: 'recording', op: 'cut', edit: report.id, words: report.beats.flatMap(p => p.indices), by, label: `Cut “${short(report.words)}”` };
  } else if (body.command === 'recording.split') {
    const words = analyse(dir, sb, raw).timing?.beats.find(x => x.id === b.id)?.vo?.words ?? [];
    const k = body.k, w = words[k];
    if (!w || k < 1) throw fail('Split before a word that is not the first.');
    const nth = words.slice(0, k + 1).filter(x => wordKey(x.w) === wordKey(w.w)).length;
    const r = splitBeat(dir, { beat: b.id, at: w.w, nth }, { by });
    entry = { kind: 'recording', op: 'split', edit: r.id, by, label: `Split ${short(nameOf(b))} before “${w.w}”`, undo: false };
  } else if (body.command === 'recording.merge') {
    const i = sb.beats.indexOf(b), next = sb.beats[i + 1];
    if (!next) throw fail('This is the last scene.');
    const r = mergeBeats(dir, { beats: [b.id, next.id] }, { by });
    entry = { kind: 'recording', op: 'merge', edit: r.id, by, label: `Merge ${short(nameOf(b))} with the next scene`, undo: false };
  } else throw fail('Unknown recording edit.');
  const after = read(dir);
  if (!ok) { h.entries = []; h.cursor = 0; }
  h.entries = h.entries.slice(0, h.cursor);
  // Splits and merges are kept in review/edits.jsonl; their inverse is a new merge or split, not an undo.
  h.entries.push({ ...entry, before: raw, after, at: new Date().toISOString() });
  h.cursor = h.entries.length; trim(h);
  atomic(historyFile(dir), JSON.stringify(h));
  return studioState(dir);
}

// ------------------------------------------------------------------ what the inspector may offer

let described = null;
/** Field contracts for the inspector: schema fields, block props and library choices. */
export function studioSchema() {
  if (described) return described;
  const beat = SCHEMA.properties.beats.items.properties;
  described = {
    film: Object.fromEntries([...FILM_KEYS].filter(k => SCHEMA.properties[k]).map(k => [k, SCHEMA.properties[k]])),
    beat: Object.fromEntries([...BEAT_KEYS].filter(k => beat[k]).map(k => [k, beat[k]])),
    blocks: BLOCKS.map(b => ({ name: b.name, category: b.category, summary: b.summary, props: b.props, example: b.example })),
    palettes: items('palettes').map(p => ({ id: p.id, colors: p.colors, notes: p.notes ?? '' })),
    types: items('types').map(t => ({ id: t.id, title: t.title, when: t.when })),
    treatments: items('treatments').map(t => ({ id: t.id, title: t.title, when: t.when })),
    sketches: items('sketches').map(s => { let art = false; try { art = !!sketch(s.id).layer; } catch {} return { id: s.id, summary: s.summary, use: s.use, art }; }),
    canvas: { types: Object.keys(ELEMENT_TYPES), geometry: Object.fromEntries(Object.entries(ELEMENT_TYPES).map(([k, v]) => [k, v.geometry])), enters: ENTERS, exits: EXITS, colors: COLOR_TOKENS, fonts: Object.keys(FONT_FILES), icons: ICONS },
    transitions: TRANSITIONS, backdrops: BACKDROPS, motions: MOTIONS, lens: { keys: LENS_KEYS, grades: LENS_GRADES }, defaults: DEFAULTS, presets: PRESETS,
  };
  return described;
}
