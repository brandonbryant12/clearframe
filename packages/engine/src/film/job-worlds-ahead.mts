import type { JobBeat } from './types.mjs';

import { groundOf } from './job-worlds-elements.mjs';
export function drawWorldAhead(
  a: JobBeat,
  b: JobBeat,
  fps: number,
  at: number,
): void {
  if (at >= 0) return;
  a.props.viewNext = {
    to: b.props.view,
    at: a.frames / fps + at,
    dur: b.props.viewDur ?? 1.2,
  };
  // The camera leaves for the next panel before its beat begins: draw that panel's ground (what
  // stands from its first frame) ahead, so the move does not cross empty paper (a round-18 board
  // film showed blank frames mid-pan). It goes at the cut, where the panel itself takes over.
  const ground = groundOf(
    (b.props.elements ?? []).filter((el) => !el.carried && !el.behind),
  );
  if (ground.length)
    (a.props.elements ??= []).push({
      type: 'group',
      at: Math.max(0, a.frames / fps + at),
      enter: 'fade',
      dur: 0.3,
      exitAt: a.frames / fps,
      exit: 'none',
      exitDur: 0,
      children: ground,
    });
}
