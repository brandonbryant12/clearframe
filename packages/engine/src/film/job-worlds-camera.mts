import type { JobBeat } from './types.mjs';

import { worldCameraTime } from './job-worlds-time.mjs';
import { drawWorldAhead } from './job-worlds-ahead.mjs';
export function moveWorldCamera(
  a: JobBeat,
  b: JobBeat,
  fps: number,
  adjacent: boolean,
): void {
  // Start where the last beat's camera ended: its view, drifted in.
  const view = a.props.view;
  if (!Array.isArray(view))
    throw new Error(`${a.id}: world view must resolve to a rectangle`);
  const [x, y, w, h] = view,
    d = a.props.viewDrift ?? 0;
  b.props.viewFrom = [
    x + (w * d) / 2,
    y + (h * d) / 2,
    w * (1 - d),
    h * (1 - d),
  ];
  b.props.viewDur ??= 1.2;
  // Land on the new line, not after it: arrive by its first word or first new drawing.
  // Across a cut the move starts in the outgoing beat's tail (once it has settled).
  const at = worldCameraTime(a, b, fps, adjacent);
  drawWorldAhead(a, b, fps, at);
  b.props.viewAt = at;
  b.settle_seconds = Math.max(b.settle_seconds, at + (b.props.viewDur ?? 1.2));
}
