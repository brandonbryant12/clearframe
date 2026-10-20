// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.

// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import { COVER } from '../constants.mjs';

export interface RangeJob {
  fps: number;
  frames: number;
  beats: {
    id: string;
    start_frame: number;
    frames: number;
    transition?: string;
  }[];
}
import type { RangeOptions } from './contracts.mjs';

/**
 * Frames [a, b) for a stretch of the prepared timeline: whole beats (with the transitions into
 * and out of them) or a time range, widened by `handles` seconds of context on either side.
 */
export function frameRange(
  job: RangeJob,
  { from, to, beats, handles = 2 }: RangeOptions = {},
) {
  const fps = job.fps;
  let a, b;
  if (beats?.length) {
    const idx = beats.map((id) => {
      const i = job.beats.findIndex((x) => x.id === id);
      if (i < 0) throw new Error(`No beat ${id} in the prepared film.`);
      return i;
    });
    const first = job.beats[Math.min(...idx)],
      last = job.beats[Math.max(...idx)],
      next = job.beats[Math.max(...idx) + 1];
    a = first.start_frame;
    b = last.start_frame + last.frames;
    // A transition draws both sides of its cut: keep the outgoing beat's exit and the next entrance.
    const span = (t: string | undefined) =>
      Math.ceil(
        Math.max(COVER[t ?? '']?.[0] ?? 0, COVER[t ?? '']?.[1] ?? 0, 0.5) * fps,
      );
    if (first.transition !== 'cut' && first.start_frame > 0)
      a -= span(first.transition);
    if (next && next.transition !== 'cut') b += span(next.transition);
  } else {
    if (
      !(
        typeof from === 'number' &&
        typeof to === 'number' &&
        Number.isFinite(from) &&
        Number.isFinite(to) &&
        to > from
      )
    )
      throw new Error('A range needs from < to (seconds).');
    a = Math.round(from * fps);
    b = Math.round(to * fps);
  }
  if (!(Number.isFinite(handles) && handles >= 0 && handles <= 30))
    throw new Error('--handles must be 0–30 seconds.');
  a = Math.max(0, a - Math.round(handles * fps));
  b = Math.min(job.frames, b + Math.round(handles * fps));
  if (!(b > a)) throw new Error('The range is outside the film.');
  const covered = job.beats
    .filter((x) => x.start_frame < b && x.start_frame + x.frames > a)
    .map((x) => ({
      id: x.id,
      film: [x.start_frame / fps, (x.start_frame + x.frames) / fps],
      // Where the beat sits inside the preview (seconds, clipped to it).
      local: [
        Math.max(0, x.start_frame - a) / fps,
        (Math.min(b, x.start_frame + x.frames) - a) / fps,
      ],
    }));
  return { a, b, covered };
}
