import type { TimedBeat } from '../domain.mjs';
import type { DecodedFrames } from './qa-contracts.mjs';
import { diff, pictureDifference, localDifference } from './qa-pixels.mjs';
export function frameSignals(
  film: DecodedFrames,
  beats: TimedBeat[],
  fps: number,
  w: number,
  h: number,
  captionBand: number,
  same: boolean,
) {
  const n = film.frames,
    F = Math.round(fps);
  const d = [0],
    skip = [0],
    second = [],
    local = [];
  // Burned captions sit in the bottom of the frame; their phrases are not the picture moving.
  let beatIndex = 0;
  for (let i = 1; i < n; i++) d.push(diff(film.at(i - 1), film.at(i)));
  for (let i = 1; i < n - 1; i++)
    skip.push(diff(film.at(i - 1), film.at(i + 1)));
  skip.push(0);
  for (let i = 0; i < n; i++) {
    while (beatIndex + 1 < beats.length && i / fps >= beats[beatIndex].end)
      beatIndex++;
    const withinBeat =
      !same || !beats.length || (i - F) / fps >= beats[beatIndex].start;
    second.push(
      i >= F && withinBeat
        ? pictureDifference(film.at(i - F), film.at(i))
        : Infinity,
    );
    local.push(
      i >= F && withinBeat
        ? localDifference(film.at(i - F), film.at(i), w, h, captionBand)
        : Infinity,
    );
  }
  return { d, skip, second, local };
}
