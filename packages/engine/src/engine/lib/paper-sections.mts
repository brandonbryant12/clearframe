import { formatTime as t } from './notes.mjs';
import { listRevisions } from './revisions.mjs';
import { editParts } from './recording-model.mjs';
import { suggestCuts } from './paper-suggestions.mjs';
import type { PaperBeat } from './paper-suggestions.mjs';
import type { PaperContext } from './paper-context.mjs';
export function paperHeader(ctx: PaperContext): string[] {
  const { timing, manifest, transcript } = ctx;
  const latest = listRevisions(ctx.root).at(-1);
  const measured = timing.beats.filter(
      (b) => b.vo?.wordTiming === 'measured',
    ).length,
    voiced = timing.beats.filter((b) => b.vo).length;
  const recordOffset = manifest?.offset
    ? ` from ${t(Number(manifest.offset))}`
    : '';
  const recording = manifest
    ? ` · recording ${manifest.input ?? manifest.file}${recordOffset}`
    : '';
  return [
    `# Paper edit · ${timing.title}`,
    '',
    `<!-- clearframe paper-edit v1 · working copy${latest ? ` after ${latest.id}` : ''} · ${new Date().toISOString()} -->`,
    `${t(timing.duration)} · ${timing.beats.length} beats · word timing measured in ${measured} of ${voiced} narrated beats${voiced - measured ? ' (the rest are estimates)' : ''}${recording}`,
    '',
    transcript
      ? 'The narration is the recording as imported. Nothing is cut unless you ask: strike words with ~~like this~~ and run `cut DIR --paper review/paper-edit.md`. Cuts already made show as [cut c001: “…”] and can be undone with `uncut DIR --cut c001`.'
      : 'The narration is generated from these lines. Editing a line re-records its whole take (see the take under each beat).',
    '',
  ];
}
export function chapterHeading(
  ctx: PaperContext,
  chapter: string | null | undefined,
): string[] {
  const span = ctx.timing.beats.filter((b) => b.chapter === chapter);
  const held = span.filter(
    (b) => ctx.raw.get(b.id)?.placeholder != null,
  ).length;
  return [
    `## ${chapter ?? 'Whole film'} (${t(span[0].start)}–${t(span[span.length - 1].end)}, ${span.length} beats${held ? `, ${held} placeholder(s)` : ''})`,
    '',
  ];
}
export function removedBeats(ctx: PaperContext): string[] {
  const gone = ctx.edits
    .filter((e) => e.op === 'cut')
    .flatMap((e) =>
      editParts(e)
        .filter((p) => p.deleted && !ctx.raw.has(p.beat))
        .map((p) => ({ e, p })),
    );
  const undone = new Set(
    ctx.edits.filter((e) => e.op === 'uncut').flatMap((e) => e.of ?? []),
  );
  const remaining = gone.filter(({ e }) => !undone.has(e.id));
  if (!remaining.length) return [];
  return [
    '## Removed beats',
    '',
    ...remaining.map(
      ({ e, p }) =>
        `- [${p.beat}] removed by ${e.id}: “${p.meta?.text ?? p.storyboard?.vo ?? ''}” (undo: uncut DIR --cut ${e.id})`,
    ),
    '',
  ];
}
export function suggestedCuts(view: PaperBeat[]): string[] {
  const suggestions = suggestCuts(view);
  const lines = ['## Suggested cuts (proposals only; nothing is applied)', ''];
  if (!suggestions.length)
    lines.push(
      'None found: no filler words, doubled words or pauses over 1.2 s.',
    );
  for (const x of suggestions)
    lines.push(
      x.pause
        ? `- [${x.beat}] ${t(x.at)} ${x.why} → \`cut DIR --pauses-over 1.2 --keep 0.5 --beats ${x.beat}\``
        : `- [${x.beat}] ${t(x.at)} “${x.words}” (${x.why}) → \`cut DIR --beat ${x.beat} --words "${x.words}"\``,
    );
  return [...lines, ''];
}
