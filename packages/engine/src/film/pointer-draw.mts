import type { CanvasElement, ElementFields } from './types.mjs';
import type { PlacedStep, PointerContext } from './pointer-contracts.mjs';
import { ARROW, when, travel } from './pointer-common.mjs';

export function pointerDrawing(ctx: PointerContext): CanvasElement {
  const { p, steps, touch, size, from, xs, ys, press, ripple } = ctx;
  const last = steps[steps.length - 1];
  const k = size / 40;
  // A fingertip as screen recordings show one: a pale disc with a ring and a soft shadow, light
  // enough to see what is under it. The arrow is the system pointer.
  const cursor: CanvasElement = touch
    ? {
        type: 'circle',
        cx: 0,
        cy: 0,
        r: size / 2,
        fill: 'bg',
        opacity: 0.82,
        stroke: 'ink',
        width: Math.max(2, size * 0.045),
        shadow: true,
      }
    : {
        type: 'path',
        d: ARROW.replace(/-?\d+(\.\d+)?/g, (n) =>
          String(Math.round(Number(n) * k * 10) / 10),
        ),
        fill: 'ink',
        stroke: 'bg',
        width: Math.max(2, 3 * k),
        join: 'round',
      };
  // Unseen until the first press (a key's opacity multiplies the element's).
  const ring: CanvasElement = {
    type: 'circle',
    cx: 0,
    cy: 0,
    r: size * (touch ? 0.5 : 0.42),
    fill: 'none',
    stroke: 'ink',
    width: Math.max(2, size * 0.05),
    enter: 'none',
    origin: [0, 0],
    keys: [{ at: 0, dur: 0, opacity: 0 }, ...ripple],
  };
  return {
    type: 'group',
    ...(p.id ? { id: p.id } : {}),
    x: from[0],
    y: from[1],
    // On screen a moment before its first move, so it is seen setting off.
    ...when(steps[0], -(travel(from, steps[0].spot) + 0.45)),
    enter: 'fade',
    dur: 0.25,
    keys: xs,
    ...pointerExit(p, last),
    children: [
      {
        type: 'group',
        x: 0,
        y: 0,
        enter: 'none',
        keys: ys,
        children: [
          ...(ripple.length ? [ring] : []),
          { ...cursor, enter: 'none', origin: [0, 0], keys: press },
        ],
      },
    ],
  };
}
function pointerExit(p: CanvasElement, last: PlacedStep): ElementFields {
  if (!p.leave) return {};
  const cue =
    last.say != null
      ? { exitSay: last.say, exitAfter: 0.7 }
      : { exitAt: (last.at ?? 0) + 0.7 };
  return { ...cue, exit: 'fade' };
}
