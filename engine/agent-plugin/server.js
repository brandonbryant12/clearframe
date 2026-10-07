// ClearFrame studio tools for OpenCode. Each tool forwards to the viewer server that owns the
// film (engine/lib/agent/bridge.mjs) with the private token it wrote for this runtime; the
// server resolves the calling session to its one project and runs the same validated, undoable
// commands and bounded render queue the browser uses. Nothing here touches project files.
import fs from 'node:fs';
import { Plugin } from '@opencode/plugin';

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = description => ({ type: 'string', description });
const OP = {
  type: 'object', additionalProperties: true,
  description: 'One studio change. command: set (target film|beat, beat, path, value; null removes), insert (block or sketch, after, id), duplicate (beat), move (beat, to index), delete (beat), treatment (id), playbook (id: replace every scene with that playbook\'s structure and look, keeping title, format and sources; pick one that fits the material from clearframe_catalog topic playbooks).',
  properties: { command: { type: 'string', enum: ['set', 'insert', 'duplicate', 'move', 'delete', 'treatment', 'playbook'] }, target: { type: 'string', enum: ['film', 'beat'] },
    beat: str('Scene id'), path: str('Dotted property path, e.g. props.title or vo or duration'), value: { description: 'New JSON value; null removes it' },
    block: str('Native block name for insert'), sketch: str('Canvas sketch id for insert'), after: str('Insert after this scene id'), to: { type: 'integer' }, id: str('For insert: the new scene\'s id (lowercase, unused), so later operations in the same batch can set its props and vo. For treatment or playbook: its id.') },
  required: ['command'],
};

const TOOLS = [
  ['state', 'Read the film this conversation edits: title, format, look, every scene (id, block, label, timing, narration), engine errors and warnings, the working-copy hash you must pass to edit, undo history, open review notes and render jobs. Pass beat to get that scene\'s full JSON, or full: true for the whole storyboard.',
    obj({ beat: str('Scene id to return in full'), full: { type: 'boolean' } })],
  ['catalog', 'Look up what the engine accepts instead of guessing. Start with topic find (pass query: what the film should show, explain or make someone feel, in plain words): a short shortlist across the whole library (blocks, sketches, playbooks, looks, cast shapes and moves, stage mechanisms, examples) saying what each is and when it fits; then topic item (name: one KIND:NAME from it) for its exact authoring and a copyable example. Topic sketch (name, optional sketchText and sketchSay) returns a sketch\'s drawn elements for this film\'s frame shape, to copy into props.elements when the picture itself must change. Other topics list one kind in full: blocks, block (one block\'s props and example; pass name), palettes, types, treatments, sketches, canvas (element types, entrances, colours, fonts, icon names), transitions, motions, film-fields, beat-fields, playbooks.',
    obj({ topic: { type: 'string', enum: ['find', 'item', 'sketch', 'blocks', 'block', 'palettes', 'types', 'treatments', 'sketches', 'canvas', 'transitions', 'motions', 'film-fields', 'beat-fields', 'playbooks'] }, query: str('For find: what the film should show or make someone feel'), name: str('Block name for topic block; KIND:NAME for topic item; a sketch name for topic sketch'), shape: { type: 'string', enum: ['landscape', 'vertical', 'portrait', 'square'], description: 'For sketch: the frame shape (default: the film\'s)' }, sketchText: { type: 'object', description: 'For sketch: placeholder words to fill, e.g. {"FIRST": "Stale logs"}' }, sketchSay: { type: 'object', description: 'For sketch: named moments to land on spoken words, e.g. {"FIRST": "logs"}' } }, ['topic'])],
  ['edit', 'Change the storyboard through the studio: up to 200 operations applied as ONE validated, undoable step labelled for the person. Pass the hash from clearframe_state; if the film changed since, nothing is written and you must re-read. Edits the engine would refuse are not saved and the errors are returned. Changes outside the scope the person pinned (a scene, a layer, a range…) are refused: to go further, ask the person to widen the scope.',
    obj({ hash: str('Working-copy hash from clearframe_state'), label: str('Short past-tense description shown in undo history, e.g. "Rewrote the opening line"'), ops: { anyOf: [{ type: 'array', minItems: 1, maxItems: 200, items: OP }, { type: 'string', description: 'The same array as JSON text' }] } }, ['hash', 'label', 'ops'])],
  ['render', 'Queue a native preview through the studio\'s single render queue (visible and cancellable in the browser): still (one scene: beat, pos 0-1; or a moment: at seconds), section (beats list, with the film\'s sound), check (engine diagnostics), draft (the full-length, half-size rough cut a person watches: free local draft narration, declared placeholder scenes as labelled slates, saves a revision; pauses editing while it runs), captions. Returns a job id; follow it with clearframe_job.',
    obj({ kind: { type: 'string', enum: ['still', 'section', 'check', 'draft', 'captions'] }, beat: str('Scene id for a still'), pos: { type: 'number' }, at: { type: 'number' }, beats: { type: 'array', items: { type: 'string' } } }, ['kind'])],
  ['job', 'Status of one render job (or the newest ones for this film): queued, waiting, running with progress, complete with its output and whether it still matches the working copy, failed with the engine\'s errors, or cancelled. wait (seconds, up to 90) waits for it to finish.',
    obj({ id: str('Job id'), wait: { type: 'number' } })],
  ['look', 'Look at a finished render yourself: one bounded image per call. A still comes back scaled down; a rough cut, section or final comes back as a motion sheet, evenly spaced frames tiled in reading order with the time of each, so you see how the picture moves, not just one frame. beat narrows a rough cut or final to one scene; from/to (video seconds) narrow any video; phone: true draws each frame 360 px wide, as a phone shows it; frames sets how many (2–12, default 8). Defaults to the newest finished render. Use it after meaningful picture changes to judge hierarchy, motion and legibility, which the engine checks cannot.',
    obj({ job: str('Job id (default: the newest finished still, section, draft or final)'), beat: str('Scene id: only that scene of a rough cut or final'), from: { type: 'number' }, to: { type: 'number' }, phone: { type: 'boolean' }, frames: { type: 'number' } })],
  ['notes', 'Review notes people left on rendered revisions of this film: text, time, scene, where on the frame it was pinned, status and replies. After you act on a note, answer it (answer: {id, said: one line on what you changed, revision}) so the person sees it beside the note and can say whether it is done; never answer a note you did not act on.',
    obj({ all: { type: 'boolean', description: 'Include resolved notes' }, answer: { type: 'object', properties: { id: str('Note id, e.g. n004'), said: str('One line, in plain words, on what you changed for this note'), revision: str('The revision that has the change, when one was rendered') }, required: ['id', 'said'] } })],
  ['files', 'List the project\'s files (sources, assets, renders) with sizes and picture dimensions, or read one source document as text: Markdown, text, CSV, JSON, SRT/VTT, and DOCX, HTML, RTF or PDF converted to text. Paths are relative to the project.',
    obj({ read: str('Relative path of a document to read') })],
  ['write', 'Replace the film\'s brief (brief.md) or direction notes (DIRECTION.md) with new Markdown. The storyboard itself only changes through clearframe_edit.',
    obj({ file: { type: 'string', enum: ['brief', 'direction'] }, text: str('Complete new Markdown') }, ['file', 'text'])],
  ['sound', 'The film\'s sound: narration takes and music bed (free local draft, Google, or recorded), what Google generation would cost, and whether it is available. action draft-voice / draft-music queues a free draft. action request (kind voice|music, reason) asks the person to approve paid Google generation; it never runs without their approval.',
    obj({ action: { type: 'string', enum: ['status', 'draft-voice', 'draft-music', 'request'] }, kind: { type: 'string', enum: ['voice', 'music'] }, reason: str('Why this is worth paying for now') })],
  ['guide', 'Read ClearFrame craft guidance (instead of reading files outside the project): authoring (short: start here for a first cut), cast (objects that persist across scenes), inspiration (an idea into a few distinct concepts and the library pieces for one), clearframe, library (blocks and playbooks), cinema, canvas, dataviz, motion, script, integrity, direction, engine, review, scene (native stages); and the longer notes: style, cinema-notes, canvas-notes, scene-notes (stages and code in full), ideas, speech, images, editing, continuity.',
    obj({ topic: { type: 'string', enum: ['authoring', 'cast', 'inspiration', 'clearframe', 'library', 'cinema', 'canvas', 'dataviz', 'motion', 'script', 'integrity', 'direction', 'engine', 'review', 'scene', 'style', 'cinema-notes', 'canvas-notes', 'scene-notes', 'ideas', 'speech', 'images', 'editing', 'continuity'] } }, ['topic'])],
];

function bridge(file) {
  let b;
  try { b = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('The ClearFrame studio is not running. Start it with `clearframe viewer --serve` and open the film there.'); }
  if (!b?.url || !b?.token) throw new Error('The ClearFrame studio bridge file is incomplete.');
  return b;
}

export default Plugin.define({
  id: 'clearframe-studio',
  async setup(ctx) {
    const file = ctx.options?.bridgeFile;
    if (typeof file !== 'string') return;
    await ctx.tool.transform(editor => {
      editor.namespace({ name: 'clearframe', description: 'ClearFrame studio: read and edit the film this conversation belongs to, render native previews, read notes and sources.' });
      for (const [name, description, input] of TOOLS) {
        editor.add({
          name, description, input, options: { namespace: 'clearframe', codemode: false },
          async execute(args, context) {
            const b = bridge(file);
            const r = await fetch(new URL('/api/agent/bridge', b.url), {
              method: 'POST', signal: context.signal,
              headers: { 'content-type': 'application/json', authorization: `Bearer ${b.token}` },
              body: JSON.stringify({ tool: name, input: args ?? {}, sessionID: context.sessionID, messageID: context.messageID, callID: context.id }),
            }).catch(e => { throw new Error(context.signal?.aborted ? 'Stopped.' : `The ClearFrame studio did not answer (${e.message}). Is \`clearframe viewer --serve\` still running?`); });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j.error ?? `ClearFrame refused the request (${r.status}).`);
            // A render to look at travels as an image part of the result, so a model that reads
            // images sees it as a picture rather than as base64 text.
            const images = Array.isArray(j.images) ? j.images.filter(i => i && typeof i.data === 'string' && /^image\//.test(i.mime)) : [];
            const content = images.length
              ? [{ type: 'text', text: String(j.content ?? '') }, ...images.map(i => ({ type: 'file', uri: `data:${i.mime};base64,${i.data}`, mime: i.mime, name: i.name }))]
              : j.content;
            return { content, metadata: j.metadata ?? {} };
          },
        });
      }
    });
  },
});
