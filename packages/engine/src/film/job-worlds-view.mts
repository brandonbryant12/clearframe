import type { Timing } from '../engine/domain.mjs';
import type { JobBeat } from './types.mjs';

import { reframeView } from './canvas.mjs';

import { worldText } from './job-worlds-text.mjs';
export function frameWorld(
  b: JobBeat,
  timing: Timing,
  last: Map<string, JobBeat>,
  warnings: string[],
): void {
  // A camera rect authored for another frame shape (a landscape world in a vertical cut)
  // is re-framed on what this beat draws.
  if (
    b.block === 'canvas' &&
    Array.isArray(b.props.view) &&
    b.props.view.length === 4
  ) {
    const tall = timing.height > timing.width;
    b.props.view =
      tall && b.props.viewTall
        ? b.props.viewTall
        : reframeView(
            b.props.view,
            b.props.elements ?? [],
            timing.width / timing.height,
            last.get(b.props.world ?? '')?.props.elements ?? [],
          );
  }
  if (b.block === 'canvas') delete b.props.viewTall;
  // The camera crops the world on purpose, but a beat's own words must be in its shot.
  const v =
    b.block === 'canvas' &&
    Array.isArray(b.props.view) &&
    b.props.view.length === 4 &&
    b.props.view;
  if (v) inspectWorldView(b, v, timing, warnings);
}

function inspectWorldView(
  b: JobBeat,
  v: number[],
  timing: Timing,
  warnings: string[],
): void {
  // Parallax layers are placed for the view they were drawn in.
  for (const el of b.props.elements ?? [])
    if (el.depth != null || el.z != null)
      el.depthRef ??= [v[0] + v[2] / 2, v[1] + v[3] / 2];
  for (const el of (b.props.elements ?? []).filter(
    (el) => el.type === 'text' && !el.carried,
  ))
    worldText(el, b, v, timing, warnings);
}
