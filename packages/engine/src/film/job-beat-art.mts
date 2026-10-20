import type { CanvasElement } from './types.mjs';

import { scheduleElements, eachElement } from './canvas.mjs';

import { expandPointers } from './pointer.mjs';

import type { BeatState, ArtScheduler } from './job-beat-contracts.mjs';

export function artScheduler({
  b,
  timing,
  report,
  entrance,
  cue,
  frame,
}: BeatState): ArtScheduler {
  // Author-drawn elements: resolve spoken cues and write exact times for the renderer.
  const scheduleArt = (
    list: CanvasElement[] = [],
    start: number,
    stagger = 0,
  ) => {
    eachElement(list, (el) => {
      if (
        ['rect', 'circle', 'ellipse'].includes(el.type) &&
        el.stroke != null &&
        el.stroke !== 'none' &&
        el.fill == null
      )
        report.warnings.push(
          `${b.id}: stroked ${el.type}${el.id ? ` "${el.id}"` : ''} has no explicit fill; the native default is solid accent and can hide layers behind it. Set fill: "none" for an outline, or choose an explicit fill colour.`,
        );
    });
    // A pointer becomes a cursor that travels to its targets and presses them on their words.
    expandPointers(list, { width: timing.width, height: timing.height });
    const end = scheduleElements(list, {
      start,
      stagger,
      entrance,
      resolve: (v) => cue(v),
      limit: b.dur,
      ground: true,
    });
    eachElement(list, (el) => {
      if ((el.at ?? 0) > b.dur - frame + 1e-7)
        throw new Error(
          `a canvas element is cued at ${(el.at ?? 0).toFixed(2)}s, after the beat ends; extend the beat or move the cue.`,
        );
    });
    return end;
  };
  return scheduleArt;
}
