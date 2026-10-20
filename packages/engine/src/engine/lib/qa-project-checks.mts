import type { Storyboard, MusicTiming } from '../domain.mjs';
import type { DecodedFrames, QaFinding } from './qa-contracts.mjs';
import { diff, median, r2 } from './qa-pixels.mjs';
import { measureDrop } from './beatmap.mjs';
import { COVER, INTO_SECONDS } from '../../film/constants.mjs';
export function checkLoop(
  film: DecodedFrames,
  d: number[],
  findings: QaFinding[],
): void {
  const n = film.frames;
  // A loop must end on the picture it starts with: its seam quieter than an ordinary frame change.
  if (n > 2) {
    const seam = diff(film.at(n - 1), film.at(0)),
      typical = median(d.slice(1));
    if (seam > Math.max(1, 2 * typical))
      findings.push({
        level: 'warn',
        kind: 'loop',
        message: `loop seam ${r2(seam)} against ${r2(typical)} between neighbours: the restart shows`,
      });
  }
}
export function checkDrop(
  file: string,
  drop: MusicTiming['drop'],
  findings: QaFinding[],
): void {
  // Measure the result, not the plan: the music's drop should be heard where it was placed.
  if (drop?.film != null) {
    const heard = measureDrop(file, { near: drop.film });
    if (!heard || heard.jump < 6 || Math.abs(heard.t - drop.film) > 0.12)
      findings.push({
        level: 'warn',
        kind: 'drop',
        message:
          heard && heard.jump >= 6
            ? `the music's drop is heard at ${heard.t} s, planned for ${drop.film} s (${drop.beat ?? ''})`
            : `no drop heard near ${drop.film} s: the bass does not jump there in the mix`,
      });
  }
}
function transitionSpan(name: string): readonly number[] {
  if (name in COVER) return COVER[name];
  if (name === 'cut') return [0, 0];
  if (name === 'into') return [0, INTO_SECONDS];
  if (name === 'push') return [0, 0.6];
  return [0.35, 0.35];
}
export function transitionCovers(
  sb: Storyboard,
): Record<string, readonly number[]> {
  return Object.fromEntries(
    sb.beats.map((b) => {
      const name =
        b.into != null ? 'into' : (b.transition ?? sb.transition ?? 'cut');
      return [b.id, transitionSpan(name)];
    }),
  );
}
