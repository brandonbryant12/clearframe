// A readable edit of the working film. Marking it does not change the recording.
import { reviewPath, writeAtomic } from './store.mjs';
import { paperContext } from './paper-context.mjs';
import { paperBeat } from './paper-beat.mjs';
import {
  paperHeader,
  chapterHeading,
  removedBeats,
  suggestedCuts,
} from './paper-sections.mjs';
import { suggestCuts } from './paper-suggestions.mjs';
import type { PaperBeat } from './paper-suggestions.mjs';
export { suggestCuts } from './paper-suggestions.mjs';
export { paperCuts, paperSelections, applyPaperCuts } from './paper-cuts.mjs';
export function paperEdit(
  root: string,
  { suggest = false }: { suggest?: boolean } = {},
) {
  const ctx = paperContext(root);
  const lines = paperHeader(ctx),
    view: PaperBeat[] = [];
  let chapter: string | null | undefined;
  for (const b of ctx.timing.beats) {
    if (b.chapter !== chapter) {
      chapter = b.chapter;
      lines.push(...chapterHeading(ctx, chapter));
    }
    lines.push(...paperBeat(ctx, b));
    if (b.vo) view.push({ id: b.id, words: b.vo.words });
  }
  lines.push(...removedBeats(ctx));
  if (suggest) lines.push(...suggestedCuts(view));
  const file = reviewPath(root, 'paper-edit.md');
  writeAtomic(file, lines.join('\n'));
  return {
    file,
    beats: ctx.timing.beats.length,
    suggestions: suggest ? suggestCuts(view).length : null,
  };
}
