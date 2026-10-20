import { pictureFor } from './pictures.mjs';
import { readMeta, isRecorded } from './recording-model.mjs';
import { keptWords } from './recording.mjs';
import { formatTime as t } from './notes.mjs';
import type { Beat, TimedBeat, TimedVoice } from '../domain.mjs';
import type { RecordedMeta, Transcript, VoMeta } from './recording-model.mjs';
import type { PaperContext } from './paper-context.mjs';
function kineticPicture(raw: Partial<Beat>): string {
  const fit = pictureFor(raw.vo ?? '');
  if (!fit) return 'the words on screen (kinetic captions)';
  const use = fit.sketch ? `the \`${fit.sketch}\` sketch` : fit.use;
  return `the words on screen (kinetic captions); could be ${use}`;
}
export function pictureOf(raw: Partial<Beat>): string {
  if (raw.placeholder)
    return `placeholder: ${typeof raw.placeholder === 'object' ? raw.placeholder.text : String(raw.placeholder)}`;
  if (raw.visual) return raw.visual;
  if (raw.block === 'kinetic') return kineticPicture(raw);
  if (raw.block === 'canvas')
    return `drawing${raw.props?.world ? ` in world “${raw.props.world}”` : ''}${raw.props?.title ? `: ${raw.props.title}` : ''}`;
  const caption = raw.props?.title ?? raw.props?.text;
  return `${raw.block}${caption ? `: ${caption}` : ''}`;
}
function removedWords(
  meta: RecordedMeta,
  transcript: Transcript,
  wordSpan: number[],
): string {
  const kept = new Set(keptWords(meta, transcript).map((w) => w.index));
  const parts: string[] = [];
  let run: { id: string; words: string[] } | null = null;
  for (const [n, w] of transcript.words.slice(...wordSpan).entries()) {
    if (kept.has(wordSpan[0] + n)) {
      if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`);
      run = null;
      parts.push(w.w);
      continue;
    }
    const middle = Math.round(((w.t0 + w.t1) / 2) * transcript.rate);
    const removal = meta.source.removed?.find(
      (r) => middle >= r.samples[0] && middle < r.samples[1],
    );
    if (run && run.id === removal?.id) {
      run.words.push(w.w);
      continue;
    }
    if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`);
    run = { id: removal?.id ?? '?', words: [w.w] };
  }
  if (run) parts.push(`[cut ${run.id}: “${run.words.join(' ')}”]`);
  return parts.join(' ');
}
function recordedLines(
  meta: RecordedMeta,
  transcript: Transcript,
  fps: number,
  id: string,
): string[] {
  const wordSpan = meta.source.words,
    span = meta.source.span;
  if (!wordSpan || !span)
    throw new Error(`${id}: imported voice is missing its source spans`);
  const offset = meta.source.offset ?? transcript.offset ?? 0;
  const first = span[0] / fps + offset,
    last = span[1] / fps + offset;
  return [
    `Recording: ${t(first)}–${t(last)}${meta.alignment?.kind === 'measured' ? '' : ' (word timing estimated)'}`,
    `> ${removedWords(meta, transcript, wordSpan)}`,
  ];
}
function generatedLines(vo: TimedVoice, meta: VoMeta | null): string[] {
  let label = 'Narration not recorded yet (timing estimated)';
  if (!vo.estimated) {
    const take = meta?.take?.id;
    label = `Narration: ${meta?.provider ?? 'recorded'}${take ? `, ${take}` : ''}${vo.wordTiming === 'measured' ? '' : ' (word timing estimated)'}`;
  }
  return [label, `> ${vo.text}`];
}
export function paperBeat(ctx: PaperContext, beat: TimedBeat): string[] {
  const raw: Partial<Beat> = ctx.raw.get(beat.id) ?? {};
  const speaker = raw.speaker
    ? ` · ${ctx.sb.speakers?.[raw.speaker]?.name ?? raw.speaker}`
    : '';
  const lines = [
    `### [${beat.id}] ${t(beat.start)}–${t(beat.end)}${speaker} · ${raw.block ?? 'beat'}`,
    `Picture: ${pictureOf(raw)}`,
  ];
  const meta = readMeta(ctx.root, beat.id);
  if (ctx.transcript && isRecorded(meta))
    lines.push(...recordedLines(meta, ctx.transcript, ctx.timing.fps, beat.id));
  else if (beat.vo) lines.push(...generatedLines(beat.vo, meta));
  else lines.push('(no narration)');
  return [...lines, ''];
}
