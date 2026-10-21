import type { Point } from '../../../film/contracts/primitives.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeFields } from './fields.mjs';

export function composeButtons(context: ReturnType<typeof composeFields>) {
  const {
    send,
    phone,
    AT,
    cued,
    k,
    win,
    tb,
    sendTile,
    oldTile,
    newTile,
    sendDot,
    centre,
    tileFace,
    clipIcon,
    lockIcon,
    planeIcon,
    ui,
  } = context;

  // The toolbar: a rule over it, then Send (desktop), the old button and the new one.
  ui.push({
    type: 'line',
    x1: phone ? win.x + round(10 * k) : win.x,
    y1: tb.y,
    x2: phone ? win.x + win.w - round(10 * k) : win.x + win.w,
    y2: tb.y,
    stroke: 'line',
    width: 2,
    enter: 'none',
  } satisfies CanvasElement);

  // The old button: the pointer reaches for it out of habit as the scene opens (it lights as a
  // hover), then on OLD it is struck through and dimmed.
  ui.push({
    type: 'group',
    enter: 'none',
    at: 0,
    keys: [cued('OLD', 0.05, { dur: 0.45, opacity: 0.42 })],
    children: [
      {
        type: 'rect',
        ...oldTile,
        r: round(18 * k),
        fill: 'bg',
        stroke: 'line',
        width: 2,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'rect',
        ...oldTile,
        r: round(18 * k),
        fill: 'wash',
        stroke: 'accent',
        width: round(3 * k),
        enter: 'fade',
        at: 0.95,
        dur: 0.25,
        exit: 'fade',
        exitCue: 'OLD',
        exitAt: AT.OLD,
        exitDur: 0.3,
      } satisfies CanvasElement,
      ...tileFace(oldTile, 'OLD', clipIcon, 'ink'),
    ],
  } satisfies CanvasElement);

  // The new button: lit and pressed on NEW.
  const [ncx, ncy] = centre(newTile);

  ui.push({
    type: 'group',
    enter: 'none',
    at: 0,
    origin: [ncx, ncy],
    keys: [cued('NEW', 0, { dur: 0.32, ease: 'thereAndBack', scale: 0.93 })],
    children: [
      {
        type: 'rect',
        ...newTile,
        r: round(18 * k),
        fill: 'bg',
        stroke: 'line',
        width: 2,
        enter: 'none',
      } satisfies CanvasElement,
      ...tileFace(newTile, 'NEW', lockIcon, 'ink'),
      {
        type: 'group',
        enter: 'fade',
        dur: 0.25,
        ...cued('NEW'),
        children: [
          {
            type: 'rect',
            ...newTile,
            r: round(18 * k),
            fill: 'accent',
            enter: 'none',
            glow: { blur: 28, opacity: 0.45 },
          } satisfies CanvasElement,
          ...tileFace(newTile, 'NEW', lockIcon, 'bg'),
        ],
      } satisfies CanvasElement,
    ],
  } satisfies CanvasElement);

  // Send: a dark button in the toolbar, or a round one in a phone's app bar; it pulses on SEND.
  const sendAt: Point = phone ? [sendDot.cx, sendDot.cy] : centre(sendTile);

  ui.push({
    type: 'group',
    enter: 'none',
    at: 0,
    origin: sendAt,
    ...(send
      ? {
          keys: [
            cued('SEND', 0, { dur: 0.45, ease: 'thereAndBack', scale: 1.12 }),
          ],
        }
      : {}),
    children: phone
      ? [
          {
            type: 'circle',
            cx: sendDot.cx,
            cy: sendDot.cy,
            r: sendDot.r,
            fill: 'ink',
            enter: 'none',
          } satisfies CanvasElement,
          planeIcon(
            sendDot.cx - round(2 * k),
            sendDot.cy + round(2 * k),
            'bg',
            round(sendDot.r * 1.05),
          ),
        ]
      : [
          {
            type: 'rect',
            ...sendTile,
            r: round(18 * k),
            fill: 'ink',
            enter: 'none',
          } satisfies CanvasElement,
          ...tileFace(
            sendTile,
            'Send',
            (cx: number, cy: number, c: string) => planeIcon(cx, cy, c),
            'bg',
          ),
        ],
  } satisfies CanvasElement);
  return {
    ...context,
    send,
    phone,
    cued,
    k,
    win,
    tb,
    oldTile,
    newTile,
    centre,
    clipIcon,
    ui,
    ncx,
    ncy,
    sendAt,
  };
}
