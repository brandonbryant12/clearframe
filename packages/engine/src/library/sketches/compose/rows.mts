import type { Point } from '../../../film/contracts/primitives.mjs';
import type { Rectangle } from '.././drawing/contracts.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeFrame } from './frame.mjs';

export function composeRows(context: ReturnType<typeof composeFrame>) {
  const { expires, send, phone, stackTag, k, s, win, inner } = context;

  // Rows, top to bottom.
  let y = win.y + s.top;

  const bar = { y, h: s.bar };

  y += s.bar;

  const toRow = { y, h: s.row };

  y += s.row;

  const subRow = { y, h: s.row };

  y += s.row + s.gap;

  const body = { y, h: 2 * round(s.body * 1.32) };

  y += body.h + s.gap;

  const fileW = phone ? inner.w : Math.min(inner.w, round(680 * k));

  const file = { x: inner.x, y, w: fileW, h: s.chip };

  const tagW = stackTag
    ? Math.min(inner.w - 2 * s.tb - s.chip, round(380 * k))
    : round(360 * k);

  const desktopLinkWidth = Math.min(inner.w, round((expires ? 1040 : 720) * k));
  const link = {
    x: inner.x,
    y,
    w: phone || stackTag ? inner.w : desktopLinkWidth,
    h: s.chip + (expires && stackTag ? s.tag + 16 : 0),
  };

  y += link.h;

  const toast = send
    ? { x: 0, w: Math.min(inner.w, round(560 * k)), h: s.toast, y: y + s.gap }
    : null;

  if (toast) toast.x = round(win.x + (win.w - toast.w) / 2);

  // The toolbar: along the window's foot (and above a phone's home bar).
  const tb = {
    y: win.y + win.h - s.foot - s.tile - 2 * s.tb,
    h: s.tile + 2 * s.tb,
  };

  const tileY = tb.y + s.tb;

  // Desktop: Send, a gap, the old button and the new one, narrowed together in a narrow window.
  const [sw, g1, ow, g2, nw] = [176, 44, 240, 28, 340].map((v) => v * k);

  const fit = Math.min(1, inner.w / (sw + g1 + ow + g2 + nw));

  const sendTile = { x: inner.x, y: tileY, w: round(sw * fit), h: s.tile };

  const oldTile = phone
    ? { x: inner.x, y: tileY, w: round((inner.w - s.tb) / 2), h: s.tile }
    : {
        x: round(inner.x + (sw + g1) * fit),
        y: tileY,
        w: round(ow * fit),
        h: s.tile,
      };

  const newTile = phone
    ? {
        x: oldTile.x + oldTile.w + s.tb,
        y: tileY,
        w: inner.r - (oldTile.x + oldTile.w + s.tb),
        h: s.tile,
      }
    : {
        x: round(inner.x + (sw + g1 + ow + g2) * fit),
        y: tileY,
        w: round(nw * fit),
        h: s.tile,
      };

  // Send on a phone: a round button at the right of the app bar.
  const sendDot = {
    cx: inner.r - round(36 * k),
    cy: round(bar.y + bar.h / 2),
    r: round(36 * k),
  };

  const centre = (r: Rectangle): Point => [
    round(r.x + r.w / 2),
    round(r.y + r.h / 2),
  ];
  return {
    ...context,
    expires,
    send,
    phone,
    stackTag,
    k,
    s,
    win,
    inner,
    bar,
    toRow,
    subRow,
    body,
    file,
    tagW,
    link,
    toast,
    tb,
    sendTile,
    oldTile,
    newTile,
    sendDot,
    centre,
  };
}
