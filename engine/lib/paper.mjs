// The paper edit: the film as a document a person can read and mark up before (or instead
// of) watching it. Chapters, beats with timecodes, who speaks, what the picture is meant to
// be, the transcript, and the recording's own time for each beat. Cuts already applied show
// as [cut c004: “…”]. Striking words with ~~…~~ and running `cut DIR --paper FILE` cuts
// exactly those words from the recording; nothing is cut until then.
import fs from 'node:fs';
import path from 'node:path';
import { computeTiming } from './timing.mjs';
import { readJSONFile, reviewPath, writeAtomic } from './store.mjs';
import { ensureTranscript, isRecorded, keptWords, readEdits, cutWords } from './recording.mjs';
import { wordKey } from './word-timing.mjs';
import { formatTime } from './notes.mjs';
import { listRevisions } from './revisions.mjs';

const FILLERS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm'];
const PHRASES = [
  ['you', 'know'],
  ['i', 'mean'],
  ['sort', 'of'],
  ['kind', 'of'],
];
const t = s => formatTime(s);

function pictureOf(b, raw) {
  if (raw.placeholder) return `placeholder: ${typeof raw.placeholder === 'string' ? raw.placeholder : raw.placeholder.text}`;
  if (raw.visual) return raw.visual;
  if (raw.block === 'kinetic') return 'the words on screen (kinetic captions)';
  if (raw.block === 'canvas') return `drawing${raw.props?.world ? ` in world “${raw.props.world}”` : ''}${raw.props?.title ? `: ${raw.props.title}` : ''}`;
  return `${raw.block}${raw.props?.title ? `: ${raw.props.title}` : raw.props?.text ? `: ${raw.props.text}` : ''}`;
}

/** Mechanical candidates only: filler words, doubled words, long pauses. Proposals, never applied. */
export function suggestCuts(beats) {
  const out = [];
  for (const b of beats) {
    const keys = b.words.map(w => wordKey(w.w));
    keys.forEach((k, i) => {
      if (FILLERS.includes(k)) out.push({ beat: b.id, at: b.words[i].t0, words: b.words[i].w, why: 'filler word' });
      if (i && k && k === keys[i - 1] && !FILLERS.includes(k)) out.push({ beat: b.id, at: b.words[i].t0, words: `${b.words[i - 1].w} ${b.words[i].w}`, why: 'doubled word (cut one)' });
      for (const p of PHRASES)
        if (p.every((x, j) => keys[i + j] === x) && (i === 0 || /[,.]$/.test(b.words[i - 1].w)))
          out.push({ beat: b.id, at: b.words[i].t0, words: b.words.slice(i, i + p.length).map(w => w.w).join(' '), why: 'verbal filler' });
      if (i && b.words[i].t0 - b.words[i - 1].t1 > 1.2)
        out.push({ beat: b.id, at: b.words[i - 1].t1, words: '', why: `${(b.words[i].t0 - b.words[i - 1].t1).toFixed(1)} s pause`, pause: true });
    });
  }
  return out;
}

export function paperEdit(root, { suggest = false } = {}) {
  const timing = computeTiming(root);
  const sb = readJSONFile(path.join(root, 'storyboard.json'));
  const raw = new Map(sb.beats.map(b => [b.id, b]));
  const manifest = readJSONFile(path.join(root, 'source', 'recording.json'), null);
  let transcript = null;
  try {
    transcript = fs.existsSync(path.join(root, 'source', 'recording.wav')) ? ensureTranscript(root) : null;
  } catch {}
  const edits = readEdits(root);
  const latest = listRevisions(root).at(-1);
  const measured = timing.beats.filter(b => b.vo?.wordTiming === 'measured').length,
    voiced = timing.beats.filter(b => b.vo).length;
  const lines = [
    `# Paper edit · ${timing.title}`,
    '',
    `<!-- clearframe paper-edit v1 · working copy${latest ? ` after ${latest.id}` : ''} · ${new Date().toISOString()} -->`,
    `${t(timing.duration)} · ${timing.beats.length} beats · word timing measured in ${measured} of ${voiced} narrated beats${voiced - measured ? ' (the rest are estimates)' : ''}${manifest ? ` · recording ${manifest.input ?? manifest.file}${manifest.offset ? ` from ${t(manifest.offset)}` : ''}` : ''}`,
    '',
    transcript
      ? 'The narration is the recording as imported. Nothing is cut unless you ask: strike words with ~~like this~~ and run `cut DIR --paper review/paper-edit.md`. Cuts already made show as [cut c001: “…”] and can be undone with `uncut DIR --cut c001`.'
      : 'The narration is generated from these lines. Editing a line re-records its whole take (see the take under each beat).',
    '',
  ];
  let chapter = undefined;
  const view = [];
  for (const b of timing.beats) {
    const r = raw.get(b.id) ?? {};
    if (b.chapter !== chapter) {
      chapter = b.chapter;
      const span = timing.beats.filter(x => x.chapter === chapter);
      const held = span.filter(x => raw.get(x.id)?.placeholder != null).length;
      lines.push(`## ${chapter ?? 'Whole film'} (${t(span[0].start)}–${t(span.at(-1).end)}, ${span.length} beats${held ? `, ${held} placeholder(s)` : ''})`, '');
    }
    const meta = readJSONFile(path.join(root, 'assets', 'vo', `${b.id}.json`), null);
    lines.push(`### [${b.id}] ${t(b.start)}–${t(b.end)}${r.speaker ? ` · ${sb.speakers?.[r.speaker]?.name ?? r.speaker}` : ''} · ${r.block ?? 'beat'}`);
    lines.push(`Picture: ${pictureOf(b, r)}`);
    if (transcript && isRecorded(meta)) {
      const offset = meta.source.offset ?? transcript.offset ?? 0;
      const all = transcript.words.slice(...meta.source.words);
      const kept = new Set(keptWords(meta, transcript).map(w => w.index));
      const first = meta.source.span[0] / timing.fps + offset,
        last = meta.source.span[1] / timing.fps + offset;
      lines.push(`Recording: ${t(first)}–${t(last)}${meta.alignment?.kind === 'measured' ? '' : ' (word timing estimated)'}`);
      // Removed words, grouped by the cut that removed them.
      const parts = [];
      let run = null;
      all.forEach((w, n) => {
        const index = meta.source.words[0] + n;
        if (kept.has(index)) {
          if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`), (run = null);
          parts.push(w.w);
        } else {
          const r2 = (meta.source.removed ?? []).find(x => Math.round(((w.t0 + w.t1) / 2) * transcript.rate) >= x.samples[0] && Math.round(((w.t0 + w.t1) / 2) * transcript.rate) < x.samples[1]);
          if (run && run.id === r2?.id) run.words.push(w.w);
          else {
            if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`);
            run = { id: r2?.id ?? '?', words: [w.w] };
          }
        }
      });
      if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`);
      lines.push(`> ${parts.join(' ')}`);
      view.push({ id: b.id, words: b.vo.words });
    } else if (b.vo) {
      const take = meta?.take?.id;
      lines.push(`${b.vo.estimated ? 'Narration not recorded yet (timing estimated)' : `Narration: ${meta?.provider ?? 'recorded'}${take ? `, ${take}` : ''}${b.vo.wordTiming === 'measured' ? '' : ' (word timing estimated)'}`}`);
      lines.push(`> ${b.vo.text}`);
      view.push({ id: b.id, words: b.vo.words });
    } else lines.push('(no narration)');
    lines.push('');
  }
  // Beats removed whole by a cut no longer have a section; list them so nothing vanishes.
  const gone = edits.filter(e => e.op === 'cut').flatMap(e => (e.beats ?? []).filter(p => p.deleted && !raw.has(p.beat)).map(p => ({ e, p })));
  const undone = new Set(edits.filter(e => e.op === 'uncut').flatMap(e => e.of));
  const stillGone = gone.filter(({ e }) => !undone.has(e.id));
  if (stillGone.length) {
    lines.push('## Removed beats', '');
    for (const { e, p } of stillGone) lines.push(`- [${p.beat}] removed by ${e.id}: “${p.meta?.text ?? p.storyboard?.vo ?? ''}” (undo: uncut DIR --cut ${e.id})`);
    lines.push('');
  }
  if (suggest) {
    const s = suggestCuts(view);
    lines.push('## Suggested cuts (proposals only; nothing is applied)', '');
    if (!s.length) lines.push('None found: no filler words, doubled words or pauses over 1.2 s.');
    for (const x of s)
      lines.push(
        x.pause
          ? `- [${x.beat}] ${t(x.at)} ${x.why} → \`cut DIR --pauses-over 1.2 --keep 0.5 --beats ${x.beat}\``
          : `- [${x.beat}] ${t(x.at)} “${x.words}” (${x.why}) → \`cut DIR --beat ${x.beat} --words "${x.words}"\``,
      );
    lines.push('');
  }
  const file = reviewPath(root, 'paper-edit.md');
  writeAtomic(file, lines.join('\n'));
  return { file, beats: timing.beats.length, suggestions: suggest ? suggestCuts(view).length : null };
}

/**
 * Words struck through (~~…~~) in a printed paper edit → recording cuts. Each beat's line must
 * still match the film word for word; a beat that changed since printing is refused, never
 * guessed. Adjacent struck runs across a beat boundary become one cut.
 */
export function paperCuts(root, file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/clearframe paper-edit v1/.test(text)) throw new Error(`${file} is not a ClearFrame paper edit.`);
  const transcript = ensureTranscript(root);
  const runs = [];
  for (const m of text.matchAll(/^### \[([a-z0-9][a-z0-9-_]*)\][^\n]*\n(?:(?!### )[^\n]*\n)*?> ([^\n]*)/gim)) {
    const [, beat, line] = m;
    const meta = readJSONFile(path.join(root, 'assets', 'vo', `${beat}.json`), null);
    if (!isRecorded(meta)) continue;
    // Drop already-applied cut markers; split into words, remembering which were struck.
    const clean = line.replace(/\[cut [^\]]*\]/g, ' ');
    const tokens = [];
    let struck = false;
    for (const part of clean.split(/(~~)/)) {
      if (part === '~~') {
        struck = !struck;
        continue;
      }
      for (const w of part.split(/\s+/).filter(Boolean)) tokens.push({ w, struck });
    }
    if (struck) throw new Error(`[${beat}]: a ~~ is not closed.`);
    const kept = keptWords(meta, transcript);
    const same = tokens.length === kept.length && tokens.every((x, k) => wordKey(x.w) === wordKey(kept[k].w));
    if (!same) {
      if (tokens.some(x => x.struck)) throw new Error(`[${beat}] no longer reads as printed (it was edited since); print the paper edit again.`);
      continue;
    }
    tokens.forEach((x, k) => {
      if (!x.struck) return;
      const last = runs.at(-1);
      if (last && last.to.beat === beat && last.to.k === k - 1) last.to = { beat, k };
      else runs.push({ from: { beat, k }, to: { beat, k }, words: [] });
    });
  }
  return runs;
}

/** Apply struck words as cuts, one undoable cut per run (runs that touch across a beat join). */
export function applyPaperCuts(root, file, opts) {
  const runs = paperCuts(root, file);
  if (!runs.length) return [];
  const sb = readJSONFile(path.join(root, 'storyboard.json'));
  const order = sb.beats.map(b => b.id);
  // Join a run that ends a beat to one that starts the next recorded beat.
  const joined = [];
  for (const r of runs) {
    const prev = joined.at(-1);
    const meta = prev && readJSONFile(path.join(root, 'assets', 'vo', `${prev.to.beat}.json`), null);
    const lastK = meta ? keptWords(meta, ensureTranscript(root)).length - 1 : -1;
    if (prev && prev.to.k === lastK && r.from.k === 0 && order.indexOf(r.from.beat) === order.indexOf(prev.to.beat) + 1) prev.to = r.to;
    else joined.push({ ...r });
  }
  // Apply from the end of the film backwards, so earlier word positions stay valid.
  return joined.reverse().map(r => cutWords(root, { from: r.from, to: r.to }, opts));
}
