import type { Timing } from '../engine/domain.mjs';
import type { JobReport, JobBeat } from './types.mjs';

import { ENTRANCE, COVER } from './constants.mjs';

/**
 * A graphic transition covers the cut, so the outgoing scene must have room to finish its
 * cover after its last word and settled values; otherwise fall back to a fade.
 */
export function fitGraphicTransitions(
  beats: JobBeat[],
  timing: Timing,
  { warnings }: JobReport,
) {
  for (let i = 0; i + 1 < beats.length; i++) {
    const a = beats[i],
      next = beats[i + 1],
      cover = COVER[next.transition];
    if (!cover) continue;
    const seconds = a.frames / timing.fps;
    const earliest = Math.max(
      a.words.at(-1)?.end ?? 0,
      ENTRANCE[a.motion.preset] + 0.25,
      a.settle_seconds,
      COVER[a.transition]?.[1] ?? 0,
    );
    if (seconds - earliest < cover[0] - 1e-6 && a.exit === next.transition) {
      // Name what actually holds the scene: the voice, or an element still moving.
      const spoken = a.words.at(-1)?.end ?? 0;
      const cause =
        a.settle_seconds > spoken + 1e-3
          ? `an element is still moving until ${a.settle_seconds.toFixed(2)}s (a key, count or exit); end it earlier`
          : 'the line runs to the end of the beat; add tail or shorten the line';
      warnings.push(
        `${a.id} → ${next.id}: no room for the ${next.transition} transition (${(seconds - earliest).toFixed(2)}s free, needs ${cover[0]}s): ${cause}. Using a fade.`,
      );
      next.transition = 'fade';
      a.exit = 'fade';
    }
  }
}
