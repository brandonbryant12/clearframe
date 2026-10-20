import { inspectMetrics, rowAir } from './metrics.mjs';
import { required } from '.././drawing/contracts.mjs';

import { round, tall, body } from '../../../film/sketch-kit.mjs';

import type { inspectValidate } from './validate.mjs';

export function inspectLayout(context: ReturnType<typeof inspectValidate>) {
  const { w, h, marks, attach, report } = context;

  const T = tall(w, h);

  const b = body(w, h);

  // Wide frames pull the labels out beside the card; narrow ones (tall, square) under each part.
  const side = w >= 1400;

  const compact = !side && h < 1500;

  const metrics = inspectMetrics(side, compact);
  const fs = metrics.fs;

  const pad = metrics.pad;

  const badge = metrics.badge;

  const labelW = 520;

  const gap = 64;

  const cw = side ? Math.min(900, round(b.w * 0.54)) : w - 180;

  const cx0 = side ? round((w - (cw + gap + labelW)) / 2) : round((w - cw) / 2);

  const air = rowAir(side, compact, attach);

  const callout = metrics.callout;

  // With report, a toolbar runs along the card's top (the Report phish button at its right).
  const bar = report ? metrics.bar : 0;

  // Rows top to bottom (relative to the card's inner top). Under a marked part, a narrow frame
  // keeps room for its label.
  const rows: Record<string, { y: number; h: number; w?: number }> = {};

  let cur = 0;

  const row = (part: string, height: number, extra: { w?: number } = {}) => {
    rows[part] = { y: cur, h: height, ...extra };
    cur += height;
    if (!side && marks.includes(part)) cur += callout;
  };

  const avatar = metrics.avatar;

  row('sender', avatar);

  cur += round(28 * air);

  const divider = cur;

  cur += round(32 * air);

  row('subject', round(fs.subject * 1.1));

  cur += round(26 * air);

  row('body', round(fs.line * 2.55));

  cur += round(34 * air);

  const bw = 340;

  const bh = metrics.linkHeight;

  row('link', bh, { w: bw });

  if (attach) {
    cur += round(26 * air);
    row('attachment', 64, { w: side ? 460 : cw - 2 * pad });
  }

  const ch = cur + 2 * pad + bar;

  // The toolbar may lift the card into the room a title would take (these beats have none).
  let cy0: number;
  if (side) cy0 = Math.max(b.y - 10 - bar, b.y + (b.h - ch) / 2 - 10);
  else {
    const top = T ? b.y - 120 : 170;
    const titleOffset = T ? 40 : 0;
    const toolbarOffset = compact ? bar / 2 : 0;
    cy0 = Math.max(top, b.y + (b.h - ch) / 2 - titleOffset - toolbarOffset);
  }
  cy0 = round(cy0);

  const card = { x: cx0, y: cy0, w: cw, h: ch };

  const inner = { x: card.x + pad, y: card.y + bar + pad, w: cw - 2 * pad };

  const Y = (r: { y: number }) => round(inner.y + r.y);

  const lx = card.x + cw + gap;

  // What each mark rings: whole rows for text, the control itself for the button and the chip.
  const ringOf = (part: string) => {
    const r = rows[part];
    if (part === 'link' || part === 'attachment')
      return {
        x: inner.x - 10,
        y: Y(r) - 10,
        w: required(r.w, 'control width') + 20,
        h: r.h + 20,
      };
    return { x: inner.x - 18, y: Y(r) - 14, w: inner.w + 36, h: r.h + 28 };
  };
  return {
    ...context,
    w,
    h,
    marks,
    attach,
    report,
    T,
    b,
    side,
    compact,
    fs,
    pad,
    badge,
    labelW,
    cw,
    callout,
    bar,
    rows,
    avatar,
    divider,
    bw,
    bh,
    ch,
    card,
    inner,
    Y,
    lx,
    ringOf,
  };
}
