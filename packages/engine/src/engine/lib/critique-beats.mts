import type { CritiqueContext } from './critique-contracts.mjs';
import { onScreenWords, shotWords } from './critique-words.mjs';
import { beatHolds } from './critique-beat-holds.mjs';
import { beatSource } from './critique-beat-source.mjs';
import { beatPicture } from './critique-beat-picture.mjs';
import { beatCues } from './critique-beat-cues.mjs';
import { beatPlaceholders } from './critique-beat-placeholders.mjs';
import { beatReading } from './critique-beat-reading.mjs';
export function checkBeats(ctx: CritiqueContext): void {
  ctx.beats.forEach((b, i) => {
    const d = ctx.t[i]?.dur ?? 0,
      words =
        b._words ?? shotWords(b.props ?? {}) ?? onScreenWords(b.props ?? {});
    const beat = { ...ctx, b, i, d, words, authored: ctx.sb.beats[i]?.props };
    beatHolds(beat);
    beatSource(beat);
    beatPicture(beat);
    beatCues(beat);
    beatPlaceholders(beat);
    beatReading(beat);
  });
}
