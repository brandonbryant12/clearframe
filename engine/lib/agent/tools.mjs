// What OpenCode's ClearFrame tools do, server side. Every change goes through the studio's
// validated, hash-checked, undoable command path; every render through the bounded job queue.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { studioState, studioCommand, studioSchema, planOps } from '../viewer/studio.mjs';
import { loadViewerNotes, answerNote } from '../viewer/notes.mjs';
import { touched } from './agent.mjs';
import { soundState } from '../viewer/sound.mjs';
import { startSound, requestSpend } from '../viewer/spend.mjs';
import { canonical } from '../store.mjs';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const skill = n => `skills/${n}/SKILL.md`;
export const GUIDES = { clearframe: skill('clearframe'), library: skill('clearframe-library'), cinema: skill('clearframe-cinema'), canvas: skill('clearframe-canvas'), dataviz: skill('clearframe-dataviz'),
  motion: skill('clearframe-motion'), script: skill('clearframe-script'), integrity: skill('clearframe-integrity'), direction: skill('clearframe-direction'), engine: skill('clearframe-engine'),
  review: skill('clearframe-review'), scene: skill('clearframe-scene'), style: 'docs/style.md', 'cinema-notes': 'docs/cinema.md', 'canvas-notes': 'docs/canvas.md', 'scene-notes': 'docs/scene-engine.md', ideas: 'docs/ideas.md',
  speech: 'docs/speech.md', authoring: 'engine/agent-plugin/AUTHORING.md', cast: 'docs/cast.md', images: 'docs/image-direction.md', editing: 'docs/editing.md', continuity: 'docs/continuity.md' };
/** Drop commas that close an array or object, reading strings as strings (their text is never touched). */
function withoutTrailingCommas(text) {
  let out = '', quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === ']' || text[j] === '}') continue;
    }
    out += c;
  }
  return out;
}

/**
 * Operations sent as JSON text. A trailing comma (the commonest slip) is forgiven; anything else is
 * refused with where it broke, so the model can fix that spot instead of guessing.
 */
export function opsFromText(text) {
  const parse = t => { const v = JSON.parse(t); return Array.isArray(v) ? v : Array.isArray(v?.ops) ? v.ops : v && typeof v === 'object' && v.command ? [v] : null; };
  let error;
  for (const t of [text, withoutTrailingCommas(text)]) {
    try { const ops = parse(t); if (ops) return ops; } catch (e) { error ??= e; }
  }
  const at = Number(/position (\d+)/.exec(error?.message ?? '')?.[1]);
  const near = Number.isFinite(at) ? ` near “${text.slice(Math.max(0, at - 40), at)}⟨here⟩${text.slice(at, at + 40)}”` : '';
  throw fail(`ops must be an array of operations. The JSON text did not parse${error ? `: ${error.message}` : ' to an array'}${near}. Send ops as a JSON array (not text) if you can.`);
}
const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.csv', '.json', '.srt', '.vtt', '.docx', '.html', '.htm', '.rtf', '.pdf']);
const SKIP = new Set(['review', 'build', 'node_modules']);
/**
 * A narration record as the agent should read it: who actually spoke the line first. Draft lines
 * written before ClearFrame noted the OS voice carry the film's Google voice and style in `voice` and
 * `style`; those are settings, so they are moved under `googleSettingsAtTheTime`, never shown as used.
 */
export function voiceRecord(raw) {
  let m; try { m = JSON.parse(raw); } catch { return raw; }
  if (!m || m.provider !== 'local') return raw;
  const { voice, style, osVoice, ...rest } = m, legacy = !('osVoice' in m);
  const record = { provider: 'local', spokenBy: osVoice ? `free OS draft voice "${osVoice}"` : 'free OS draft voice (which one was not recorded)', ...rest,
    ...(legacy && (voice || style) ? { googleSettingsAtTheTime: { voice, style }, note: 'Older draft record: voice and style were the film\'s Google settings when the draft was made, not what spoke it. No Google take exists for this line.' } : {}) };
  return JSON.stringify(record, null, 2);
}

/** A picture's pixel size from its header (PNG, JPEG, GIF, WebP), or null: the agent has no shell to ask. */
export function pictureSize(file) {
  let b;
  try { const fd = fs.openSync(file, 'r'); b = Buffer.alloc(65536); b = b.subarray(0, fs.readSync(fd, b, 0, b.length, 0)); fs.closeSync(fd); } catch { return null; }
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length >= 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) }; }
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
const getAt = (o, p) => { for (const k of String(p).split('.')) { if (o == null) return undefined; o = o[k]; } return o; };
const without = (o, p) => { const c = structuredClone(o), parts = p.split('.'), last = parts.pop(); const parent = getAt(c, parts.join('.')); if (parent && typeof parent === 'object') delete parent[last]; return c; };

/**
 * Why a candidate change falls outside the scope the person pinned, or null. Scene, range, moment and
 * a note on a scene limit edits to their scenes (no film settings, no reordering, no new scenes); a
 * layer limits them to that one element of its scene, found by its own id or by its index while its
 * list keeps the length it had when pinned. Whole-film, whole-cut notes and files do not limit edits.
 */
export function scopeViolation(scope, before, after, { runEdited = false } = {}) {
  if (!scope || !['scene', 'layer', 'range', 'moment', 'note'].includes(scope.kind) || !scope.beats?.length) return null;
  const t = touched(before, after), allowed = new Set(scope.beats);
  const outside = t.beats.filter(b => !allowed.has(b));
  const problems = [outside.length && `scenes ${outside.join(', ')}`, t.film && 'film-wide settings', t.order && 'the scene order'].filter(Boolean);
  if (problems.length) return `also changes ${problems.join(' and ')}`;
  if (scope.kind !== 'layer') return null;
  const id = scope.beats[0], b0 = before.beats.find(b => b.id === id), b1 = after.beats.find(b => b.id === id);
  if (!b1) return 'removes the scene that holds the pinned layer';
  const L = scope.layer;
  if (!L) return 'the pinned layer has no recorded identity; pin it again';
  const l0 = getAt(b0, L.list), l1 = getAt(b1, L.list);
  if (!Array.isArray(l0)) return 'the pinned layer\'s list is gone';
  const i = L.id != null ? l0.findIndex(e => e?.id === L.id) : (l0.length === L.length ? L.index : -1);
  // Until this request's own first edit, the element must still be exactly what the person pinned.
  const same = i >= 0 && (runEdited || !L.sig || crypto.createHash('sha256').update(canonical(l0[i])).digest('hex').slice(0, 16) === L.sig);
  if (i < 0 || !same || (L.type && l0[i]?.type !== L.type)) return 'the pinned layer moved or changed since it was pinned (the person may have edited the scene); ask them to pin it again';
  if (canonical(without(b0, L.list)) !== canonical(without(b1, L.list))) return 'also changes other properties of the scene';
  const others0 = l0.filter((_, k) => k !== i);
  const ok = Array.isArray(l1) && ((l1.length === l0.length && canonical(l1.filter((_, k) => k !== i)) === canonical(others0)) || (l1.length === l0.length - 1 && canonical(l1) === canonical(others0)));
  return ok ? null : 'also changes other layers in the scene';
}
const TERMINAL = new Set(['complete', 'failed', 'cancelled', 'interrupted']);
const sec = n => (Number.isFinite(n) ? `${Math.round(n * 10) / 10}s` : '?');
const atomic = (file, data) => { const tmp = `${file}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); };

/**
 * A path inside the project by real path: no dot segments, and no symlink (of the file or any folder
 * on the way) leading outside the project. Lexical checks alone would follow a link out.
 */
export function inside(dir, rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 400 || path.isAbsolute(rel)) throw fail('Name a file inside the project, relative to it.');
  const root = fs.realpathSync(dir), file = path.resolve(root, rel);
  const lexical = path.relative(root, file);
  if (lexical.startsWith('..') || lexical.split(path.sep).some(s => s.startsWith('.'))) throw fail('That file is outside the project.');
  let real;
  try { real = fs.realpathSync(file); } catch { throw fail(`No file ${rel}.`); }
  if (!real.startsWith(root + path.sep)) throw fail('That file links outside the project.', 403);
  return real;
}

export function createTools({ base, jobs, filmOf, pauseOf, currentScope }) {
  const filmId = dir => filmOf(dir)?.id;
  return {
    state({ dir, input }) {
      const st = studioState(dir), sb = st.storyboard;
      if (input.full) return { content: clip(JSON.stringify(sb, null, 1), 150000), metadata: { summary: `Read the whole storyboard (${sb.beats.length} scenes)`, hash: st.hash } };
      if (input.beat) {
        const b = sb.beats.find(x => x.id === input.beat);
        if (!b) throw fail(`No scene ${input.beat}. Scenes: ${sb.beats.map(x => x.id).join(', ')}`);
        const t = st.timing?.beats.find(x => x.id === b.id);
        return { content: [`Scene ${b.id} (${t ? `${sec(t.start)}–${sec(t.end)}` : 'timing unavailable'}), narration: ${st.narration[b.id]?.kind}${st.narration[b.id]?.editable === false ? ' (not editable as text)' : ''}`,
          `Engine errors for it: ${st.errors.filter(e => e.startsWith(`${b.id}:`)).join('; ') || 'none'}`, `Hash: ${st.hash}`, JSON.stringify(b, null, 1)].join('\n'), metadata: { summary: `Read scene ${b.id}`, hash: st.hash } };
      }
      const t = st.timing, f = sb.format ?? {};
      const notes = (() => { try { return loadViewerNotes(dir).filter(n => !n.resolved); } catch { return []; } })();
      const active = jobs.list(filmId(dir)).filter(j => !TERMINAL.has(j.status));
      const lines = [
        `Film: ${sb.title} — project format ${t ? `${t.width}×${t.height} at ${t.fps} fps, ${sec(t.duration)}${t.estimated ? ' (narration timing estimated)' : ''}; finals render at this size, rough cuts at half size (${Math.round(t.width / 2)}×${Math.round(t.height / 2)})` : 'timing unavailable'}`,
        `Look: theme ${typeof sb.theme === 'string' ? sb.theme : sb.theme?.base ?? 'default'}, type ${sb.type ?? 'default'}, motion ${sb.motion?.preset ?? sb.motion ?? 'default'}${sb.transition ? `, transition ${typeof sb.transition === 'string' ? sb.transition : sb.transition.type}` : ''}${f.preset ? `, format ${f.preset}` : ''}`,
        `Hash: ${st.hash}  (pass this to clearframe_edit)`,
        `Undo: ${st.undoLabel ?? '—'} · Redo: ${st.redoLabel ?? '—'}${st.externalChanges ? ' · edited outside the studio' : ''}`,
        st.errors.length ? `Engine refuses this working copy:\n  ${st.errors.slice(0, 12).join('\n  ')}` : 'Engine accepts this working copy.',
        st.warnings.length ? `Warnings:\n  ${st.warnings.slice(0, 8).join('\n  ')}` : null,
        `Scenes (${sb.beats.length}):`,
        ...sb.beats.map((b, i) => { const bt = t?.beats.find(x => x.id === b.id); return `${i + 1}. ${b.id} [${b.block}]${b.label ? ` "${b.label}"` : ''} ${bt ? `${sec(bt.start)}–${sec(bt.end)}` : ''}${b.placeholder ? ' PLACEHOLDER' : ''}${b.vo ? `\n   vo (${st.narration[b.id]?.kind}): ${clip(b.vo, 220)}` : ''}${b.props?.title ? `\n   title: ${clip(b.props.title, 120)}` : ''}`; }),
        st.changes ? `Since revision ${st.changes.revision}: ${[st.changes.edited.length && `edited ${st.changes.edited.join(', ')}`, st.changes.added.length && `added ${st.changes.added.join(', ')}`, st.changes.removed.length && `removed ${st.changes.removed.join(', ')}`, st.changes.film && 'film settings changed', st.changes.reordered && 'reordered'].filter(Boolean).join('; ') || 'no changes'}` : 'Not rendered yet.',
        `Open review notes: ${notes.length}${notes.length ? ' (clearframe_notes lists them)' : ''}`,
        active.length ? `Render jobs running or queued: ${active.map(j => `${j.label} (${j.status})`).join(', ')}` : null,
        pauseOf(dir) ? `Editing is paused while ${pauseOf(dir).label} runs.` : null,
      ].filter(Boolean);
      return { content: lines.join('\n'), metadata: { summary: `${sb.beats.length} scenes · ${st.errors.length ? `${st.errors.length} engine errors` : 'engine accepts it'}`, hash: st.hash } };
    },

    catalog({ dir, input }) {
      const s = studioSchema(), topic = input.topic;
      const out = {
        blocks: () => s.blocks.map(b => `${b.name} (${b.category}): ${b.summary}`).join('\n'),
        block: () => { const b = s.blocks.find(x => x.name === input.name); if (!b) throw fail(`No block ${input.name}. Blocks: ${s.blocks.map(x => x.name).join(', ')}`); return JSON.stringify({ name: b.name, summary: b.summary, props: b.props, example: b.example }, null, 1); },
        palettes: () => s.palettes.map(p => `${p.id}: ${p.notes}`).join('\n'),
        types: () => s.types.map(t => `${t.id}: ${t.title} — ${t.when ?? ''}`).join('\n'),
        treatments: () => s.treatments.map(t => `${t.id}: ${t.title} — ${t.when ?? ''}`).join('\n'),
        sketches: () => s.sketches.map(k => `${k.id}${k.art ? ' (background art)' : ''}: ${k.summary ?? ''}${k.use ? ` Use: ${k.use}` : ''}`).join('\n'),
        canvas: () => JSON.stringify(s.canvas, null, 1),
        transitions: () => JSON.stringify(s.transitions), motions: () => JSON.stringify(s.motions),
        'film-fields': () => JSON.stringify(s.film, null, 1), 'beat-fields': () => JSON.stringify(s.beat, null, 1),
        playbooks: async () => (await import('../../../film/playbooks.mjs')).playbooks().map(p => `${p.id}: ${p.title} — ${p.audience}; inputs: ${p.inputs}`).join('\n'),
        // One search over the whole library (the project's own library/ included): a short mixed
        // shortlist with what each is and when it fits; `item` gives one entry's exact authoring.
        find: async () => {
          const { useProject } = await import('../../../film/library.mjs'), { find, line } = await import('../../../film/discover.mjs');
          useProject(dir);
          if (!input.query) throw fail('find needs query: what the film should show or make someone feel, in plain words.');
          const hits = find(input.query, { limit: 10 });
          return hits.length ? `${hits.map(line).join('\n')}\n\nclearframe_catalog topic item, name KIND:NAME, for the exact authoring of one.` : 'Nothing matched; try other words (a thing, a feeling, an audience).';
        },
        item: async () => {
          const { useProject } = await import('../../../film/library.mjs'), { detail } = await import('../../../film/discover.mjs');
          useProject(dir);
          return JSON.stringify(await detail(String(input.name ?? '')), null, 1);
        },
      }[topic];
      if (!out) throw fail('Unknown catalog topic.');
      return Promise.resolve(out()).then(text => ({ content: clip(text, 120000), metadata: { summary: `Looked up ${topic}${input.name ? ` ${input.name}` : ''}${input.query ? `: ${String(input.query).slice(0, 60)}` : ''}` } }));
    },

    async edit({ dir, input, sessionID, messageID }) {
      const paused = pauseOf(dir);
      if (paused) throw fail(`${paused.label} is using the working copy. Wait for it (clearframe_job) before editing.`, 409);
      if (typeof input.label !== 'string' || !input.label.trim()) throw fail('Give the change a short label for the undo history.');
      // Some models send the operations as JSON text; accept that, refuse anything else.
      if (typeof input.ops === 'string') input.ops = opsFromText(input.ops);
      const plan = planOps(dir, input.ops);
      if (input.hash !== plan.hash) throw fail('The film changed since you read it (the person or another editor saved a change). Call clearframe_state and make your change on the current version.', 409);
      // Which request this call answers, from the call's own message: fails closed when it cannot be told.
      const { scope, run } = await currentScope(sessionID, messageID);
      const runEdited = studioState(dir).history.some(h => h.run === run && h.applied);
      const outside = scopeViolation(scope, plan.before, plan.after, { runEdited });
      if (outside) throw fail(`Not saved: the person limited this request to ${scope.label ?? scope.kind}, and this change ${outside}. Make the change inside that scope; if the request needs more, describe the broader change in your reply and ask the person to widen the scope (they choose Whole film in the composer). Never apply it without them.`, 409);
      const t = touched(plan.before, plan.after);
      const label = clip(input.label.trim(), 100);
      const r = studioCommand(dir, { command: 'batch', ops: input.ops, hash: plan.hash, label }, { actor: { by: 'agent', run } });
      if (r.hash === plan.hash) return { content: 'Nothing changed: the storyboard already says that.', metadata: { summary: 'No change', hash: r.hash } };
      const where = t.beats.length ? `scenes ${t.beats.join(', ')}` : 'film settings';
      return { content: [`Saved “${label}” as one undoable step (${where}${t.film && t.beats.length ? ' and film settings' : ''}).`, `New hash: ${r.hash}`,
        r.errors.length ? `Engine errors now: ${r.errors.slice(0, 6).join('; ')}` : 'Engine accepts the working copy.', r.warnings.length ? `Warnings: ${r.warnings.slice(0, 4).join('; ')}` : null,
        r.created?.length ? `Created: ${r.created.join(', ')}` : null].filter(Boolean).join('\n'),
        metadata: { summary: `${label} · ${where}`, beats: t.beats, hash: r.hash, run } };
    },

    render({ dir, input }) {
      if (!['still', 'section', 'check', 'draft', 'captions'].includes(input.kind)) throw fail('Render a still, section, check, draft or captions.');
      const body = { film: filmId(dir), kind: input.kind };
      if (input.kind === 'still') Object.assign(body, input.beat ? { beat: input.beat, pos: input.pos ?? 0.6 } : { at: input.at });
      if (input.kind === 'section') Object.assign(body, { beats: input.beats, handles: 0.5 });
      if (input.kind === 'captions') body.draft = true;
      // A rough cut is the first look: declared placeholders render as labelled slates (draft --rough).
      if (input.kind === 'draft') body.rough = true;
      const r = jobs.start(dir, body);
      const j = jobs.list(body.film).find(x => x.id === r.id);
      return { content: `${r.cached ? 'Already rendered for this exact version' : 'Queued'}: ${j?.label ?? input.kind} (job ${r.id}). The person can watch or cancel it in the studio; follow it with clearframe_job.`,
        metadata: { summary: `${j?.label ?? input.kind}${r.cached ? ' (cached)' : ''}`, job: r.id } };
    },

    async job({ dir, input }) {
      const film = filmId(dir), until = Date.now() + Math.min(90, Math.max(0, Number(input.wait) || 0)) * 1000;
      const pick = () => (input.id ? jobs.list(film).filter(j => j.id === input.id) : jobs.list(film).slice(-5));
      let list = pick();
      if (input.id && !list.length) throw fail('No such job for this film.');
      while (input.id && Date.now() < until && !TERMINAL.has(list[0].status)) { await new Promise(r => setTimeout(r, 1000)); list = pick(); }
      const view = j => [`${j.label} (job ${j.id}): ${j.status}${j.progress != null && j.status === 'running' ? ` ${Math.round(j.progress * 100)}%` : ''}`,
        j.status === 'complete' ? `  output (for the person to view in the studio; you cannot see images, so judge by the engine's checks): ${j.url ?? 'none'}${j.matches === false ? ' — the film changed while or since it rendered; it may not match' : ''}${j.revision ? `; saved revision ${j.revision}` : ''}` : null,
        j.media ? `  actual video: ${j.media.width}×${j.media.height}, ${sec(j.media.duration)} as encoded${j.media.authored ? ` (the film itself is ${sec(j.media.authored)}; the file rounds up to whole frames and audio)` : ''}, ${j.media.audio ? 'with sound' : 'silent'}${j.kind === 'draft' ? ' (a half-size rough cut, not the project size; its narration and music are what the Sound status says was actually made)' : ''}` : null,
        j.errors?.length ? `  engine errors: ${j.errors.join('; ')}` : null, j.status === 'failed' && !j.errors?.length ? `  log: ${clip(j.log?.slice(-1200), 1200)}` : null,
        j.result?.errors ? `  check: ${j.result.errors.length} errors, ${j.result.warnings.length} warnings${j.result.errors.length ? `: ${j.result.errors.slice(0, 6).join('; ')}` : ''}` : null].filter(Boolean).join('\n');
      return { content: list.map(view).join('\n') || 'No render jobs yet for this film.', metadata: { summary: list.length === 1 ? `${list[0].label}: ${list[0].status}` : `${list.length} jobs`, job: input.id ?? null } };
    },

    notes({ dir, input }) {
      if (input.answer) {
        const a = input.answer, n = answerNote(dir, String(a.id ?? ''), { said: a.said, revision: a.revision });
        return { content: `${n.id} marked as acted on: “${n.answer}”. The person decides whether it is done.`, metadata: { summary: `Answered note ${n.id}` } };
      }
      const all = loadViewerNotes(dir).filter(n => input.all || !n.resolved);
      return { content: all.map(n => `${n.id} [${n.state}] ${n.version ?? ''}${n.at != null ? ` at ${sec(n.at)}` : ' (whole film)'}${n.where ? ` · pinned ${n.where} of the frame${n.on ? `, on “${n.on}”` : ''}` : ''}${n.element ? ` element ${n.element}` : ''}: ${n.text}${n.by ? ` — ${n.by}` : ''}${n.answer ? `\n   ↳ you answered: ${n.answer}` : ''}${n.replies.map(r => `\n   ↳ ${r.by ?? ''}: ${r.text}`).join('')}`).join('\n') || 'No review notes.',
        metadata: { summary: `${all.length} note${all.length === 1 ? '' : 's'}` } };
    },

    async files({ dir, input }) {
      if (input.read) {
        const file = inside(dir, input.read), ext = path.extname(file).toLowerCase();
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw fail(`No file ${input.read}.`);
        if (!TEXT_EXT.has(ext)) throw fail('That file is not a readable document (Markdown, text, CSV, JSON, captions, DOCX, HTML, RTF or PDF).');
        if (fs.statSync(file).size > 25e6) throw fail('That document is larger than 25 MB.');
        let text;
        if (/^assets\/vo\/.*\.json$/.test(path.relative(dir, file).split(path.sep).join('/'))) text = voiceRecord(fs.readFileSync(file, 'utf8'));
        else if (['.md', '.markdown', '.txt', '.json', '.srt', '.vtt'].includes(ext)) text = fs.readFileSync(file, 'utf8');
        else { const { documentMarkdown } = await import('../ingest.mjs'); text = documentMarkdown(file); }
        return { content: text.length > 120000 ? `${text.slice(0, 120000)}\n\n[Truncated: ${text.length.toLocaleString('en-US')} characters in all.]` : text, metadata: { summary: `Read ${input.read}` } };
      }
      const out = [];
      const walk = (d, depth) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (e.name.startsWith('.') || e.isSymbolicLink() || (depth === 0 && SKIP.has(e.name)) || out.length >= 400) continue;
          const f = path.join(d, e.name);
          if (e.isDirectory()) { if (depth < 5) walk(f, depth + 1); } else { const px = /\.(png|jpe?g|gif|webp)$/i.test(e.name) && pictureSize(f); out.push(`${path.relative(dir, f)} (${px ? `${px.width}×${px.height} px, ` : ''}${Math.max(1, Math.round(fs.statSync(f).size / 1024))} KB)`); }
        }
      };
      walk(dir, 0);
      return { content: out.join('\n') || 'The project has no files yet.', metadata: { summary: `${out.length} files` } };
    },

    write({ dir, input }) {
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 100000) throw fail('Write the new Markdown (up to 100,000 characters).');
      const names = input.file === 'brief' ? ['brief.md', 'BRIEF.md'] : input.file === 'direction' ? ['DIRECTION.md'] : null;
      if (!names) throw fail('Write the brief or the direction notes.');
      const file = path.join(dir, names.find(n => fs.existsSync(path.join(dir, n))) ?? names[0]);
      atomic(file, input.text.replace(/\s*$/, '\n'));
      return { content: `Saved ${path.basename(file)}.`, metadata: { summary: `Rewrote ${path.basename(file)}` } };
    },

    sound({ dir, input }) {
      const action = input.action ?? 'status';
      if (action === 'draft-voice' || action === 'draft-music') {
        const r = startSound(dir, filmId(dir), jobs, { kind: action === 'draft-voice' ? 'voice' : 'music', paid: false });
        return { content: `Queued the free ${action === 'draft-voice' ? 'draft narration' : 'draft music bed'} (job ${r.id}); follow it with clearframe_job.`, metadata: { summary: action === 'draft-voice' ? 'Free draft narration' : 'Free draft music bed', job: r.id } };
      }
      if (action === 'request') {
        if (!['voice', 'music'].includes(input.kind)) throw fail('Request narration (voice) or music.');
        if (typeof input.reason !== 'string' || !input.reason.trim()) throw fail('Say why the person should pay for it.');
        const r = requestSpend(dir, input);
        return { content: r.id ? `Asked the person to approve about $${r.estimate.toFixed(3)} for Google ${input.kind === 'voice' ? 'narration' : 'music'} (${r.detail}). Nothing runs until they approve it in the studio; do not wait for it — continue or finish your reply.` : r.note,
          metadata: { summary: r.id ? `Asked to approve ≈$${r.estimate.toFixed(3)} for Google ${input.kind === 'voice' ? 'narration' : 'music'}` : 'Already up to date', spend: r.id } };
      }
      const s = soundState(dir, base);
      const n = s.narration, m = s.music, google = s.providers.speech.find(p => p.id === 'google');
      const made = t => { const by = [...new Set(t.beats.map(b => (b.made === 'local' ? `free draft voice (${b.model ?? 'os-tts'}, ${b.voice})` : b.made ? `${b.made} ${b.model ?? ''} voice ${b.voice}`.replace(/\s+/g, ' ') : 'not made yet')))];
        return `${by.join(' + ')}${t.status === 'google-changed' ? ', words changed since the Google take' : ''}${t.cost ? ` (Google take ≈$${t.cost.toFixed(3)} if approved)` : ''}`; };
      return { content: [
        `Google sound: ${google.ready ? 'available (paid; needs the person\'s approval)' : `not configured — ${google.needs}`}`,
        ...(n.recorded ? ['Narration: the source recording (edit by cutting words; not regenerated).'] : [
          `Narration as made (what the film plays now): ${n.lines} lines in ${n.takes.length} take(s): ${n.takes.map(t => `${t.id} ${made(t)}`).join('; ')}`,
          `Narration settings for Google (apply only to takes Google generates): voice ${n.voice}${n.style ? `, style "${n.style}"` : ''}, model ${n.model}. Never say a draft take used this voice or style.`]),
        m.off ? 'Music: off.' : `Music as made: ${m.made ? `${m.made === 'local' ? 'free draft bed (made on this computer)' : `${m.made} bed`}${m.current ? ' (current)' : ''}` : 'none yet'}. Settings for Google: model ${m.model}; prompt "${m.prompt || 'derived from the edit'}"; level ${m.volume}${m.duck ? ', ducked under the voice' : ''}${m.cost ? `; Google bed ≈$${m.cost.toFixed(2)}` : ''}.`,
        'Change voice, style, music prompt, model and levels with clearframe_edit (film paths voice.voice, voice.style, music.prompt, music.model, music.volume, music.duck). Free drafts: action draft-voice / draft-music. Paid Google generation: action request with kind and reason.',
      ].join('\n'), metadata: { summary: `Sound: ${n.recorded ? 'recorded narration' : `${n.takes.length} take(s)`}, music ${m.off ? 'off' : m.made ?? 'none'}` } };
    },

    guide({ input }) {
      const file = GUIDES[input.topic];
      if (!file) throw fail(`Unknown guide. Topics: ${Object.keys(GUIDES).join(', ')}.`);
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      return { content: text.length > 30000 ? `${text.slice(0, 30000)}\n\n[Truncated at 30,000 of ${text.length.toLocaleString('en-US')} characters.]` : text, metadata: { summary: `Read the ${input.topic} guide` } };
    },
  };
}
