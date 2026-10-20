import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { holdMarket } from './market.mjs';

export function holdExtremes(context: ReturnType<typeof holdMarket>) {
  const {
    falls,
    steps,
    fmt,
    peak,
    low,
    T,
    wide,
    fs,
    R,
    x0,
    lowY,
    peakY,
    pts,
    text,
    cued,
    els,
    tip,
    recede,
  } = context;

  // The market's peak: a ring and its level above it, the line's name beside the level (wide
  // frames) or over it (narrow ones).
  const iP = Math.round(T.peak * SAMPLES);

  const peakAt = tip(iP);

  const labelW = wide ? 300 : 260;

  const valueW = round(fmt(peak).length * fs.value * 0.6);

  const right = R;

  const px = wide
    ? round(
        Math.min(
          Math.max(pts[iP][0], x0 + valueW / 2 + 220),
          right - valueW / 2,
        ),
      )
    : round(
        Math.min(Math.max(pts[iP][0], x0 + labelW / 2), right - labelW / 2),
      );

  els.push({
    type: 'circle',
    cx: pts[iP][0],
    cy: peakY,
    r: 15,
    fill: 'none',
    stroke: 'accent2',
    width: 4,
    enter: 'pop',
    dur: 0.35,
    ...cued(peakAt.cue, peakAt.dt),
    keys: [recede()],
  } satisfies CanvasElement);

  els.push({
    type: 'group',
    enter: 'rise',
    dist: 16,
    dur: 0.4,
    ...cued(peakAt.cue, round(peakAt.dt + 0.1)),
    keys: [recede(0.6)],
    children: wide
      ? [
          text(
            'MARKET',
            round(px - valueW / 2 - 16),
            peakY - 34,
            fs.label - 2,
            'semibold',
            'muted',
            { anchor: 'end', fit: 280, enter: 'none' },
          ),
          text(fmt(peak), px, peakY - 34, fs.value, 'bold', 'accent2', {
            anchor: 'middle',
            fit: labelW,
            enter: 'none',
          }),
        ]
      : [
          text('MARKET', px, peakY - 82, fs.label - 2, 'semibold', 'muted', {
            anchor: 'middle',
            fit: labelW,
            enter: 'none',
          }),
          text(fmt(peak), px, peakY - 32, fs.value, 'bold', 'accent2', {
            anchor: 'middle',
            fit: labelW,
            enter: 'none',
          }),
        ],
  } satisfies CanvasElement);

  // The market's low (with a fall): its level under it, unless the lock steps down to it.
  if (falls && !steps) {
    const iLow = Math.round(required(T.low, 'fall low') * SAMPLES);
    const at = tip(iLow);
    const lowW = round(fmt(low).length * fs.value * 0.6);
    const lx = round(
      Math.min(Math.max(pts[iLow][0], x0 + lowW / 2), right - lowW / 2),
    );
    els.push({
      type: 'circle',
      cx: pts[iLow][0],
      cy: lowY,
      r: 15,
      fill: 'none',
      stroke: 'accent2',
      width: 4,
      enter: 'pop',
      dur: 0.35,
      ...cued(at.cue, at.dt),
      keys: [recede()],
    } satisfies CanvasElement);
    els.push(
      text(fmt(low), lx, lowY + 66, fs.value, 'bold', 'accent2', {
        anchor: 'middle',
        fit: labelW,
        enter: 'rise',
        dist: 16,
        dur: 0.4,
        ...cued(at.cue, round(at.dt + 0.1)),
        keys: [recede(0.6)],
      }),
    );
  }
  return {
    ...context,
    falls,
    steps,
    fmt,
    low,
    wide,
    fs,
    x0,
    lowY,
    pts,
    text,
    cued,
    els,
    tip,
    recede,
  };
}
