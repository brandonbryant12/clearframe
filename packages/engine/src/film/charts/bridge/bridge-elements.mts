import { plotLayout, titleText, titleShift } from '../../plots.mjs';

import type {
  CanvasElement,
  ElementFields,
  FrameSize,
  Point,
} from '../../types.mjs';
import type { BridgeSpec, BridgeColumn } from './contracts.mjs';
import { textWidth, show } from './primitives.mjs';
import { check } from './check.mjs';
import { bridgeColumns } from './bridge-columns.mjs';
import { bridgeColor } from './bridge-color.mjs';
import { verticalBridge } from './vertical-bridge.mjs';
import { horizontalBridge } from './horizontal-bridge.mjs';

export function bridgeElements(
  p: BridgeSpec,
  frame: FrameSize,
): CanvasElement[] {
  const { width, height } = frame,
    L = plotLayout(frame),
    font = L.type;
  // Columns suit wide frames while every name fits in two lines of its column; otherwise rows read better.
  const colsAhead = p.steps.length + 2,
    slotAhead = (L.right + width * 0.06 - L.left) / colsAhead;
  const lines = (label: string): number => {
    let n = 1,
      line = 0;
    for (const w of label.split(/\s+/)) {
      const ww = textWidth(w, font * 0.92);
      if (line && line + textWidth(' ', font * 0.92) + ww > slotAhead * 0.94) {
        n++;
        line = ww;
      } else line += (line ? textWidth(' ', font * 0.92) : 0) + ww;
    }
    return n;
  };
  const columnsFit = [
    p.start.label,
    p.end.label,
    ...p.steps.map((s) => s.label),
  ].every((l) => lines(l) <= 2);
  const vertical =
    p.orientation === 'auto'
      ? width >= height && columnsFit
      : p.orientation === 'vertical';
  if (p.orientation === 'vertical')
    check(
      columnsFit,
      'some names need more than two lines in their columns; shorten them or use orientation auto or horizontal',
    );
  const fmt = (v: number): string =>
    `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const signed = (v: number): string =>
    `${v < 0 ? '−' : '+'}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  // Axis ticks carry only the decimals they need ($60, not $60.0).
  const tickDecimals = Math.min(
    p.decimals,
    Math.max(0, ...p.ticks.map((t) => (String(t).split('.')[1] ?? '').length)),
  );
  const tick = (v: number): string =>
    `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(tickDecimals)}${p.suffix}`;
  const [lo, hi] = p.domain,
    frac = (v: number): number => (v - lo) / (hi - lo);
  const cols = bridgeColumns(p),
    n = cols.length;
  const valueText = (c: BridgeColumn): string =>
    c.kind === 'step' ? signed(c.value) : fmt(c.value);
  const motion = p.motion;
  // Each column arrives in reading order: on its spoken word when it has one, else evenly across the motion.
  const timed = (c: BridgeColumn, i: number): ElementFields =>
    c.say != null
      ? { say: c.say }
      : {
          at:
            motion === 'none'
              ? 0
              : motion.at + (motion.duration * i) / Math.max(n - 1, 1),
        };
  const grow = (
    c: BridgeColumn,
    i: number,
    axis: string,
    origin: Point,
  ): ElementFields =>
    motion === 'none'
      ? show
      : { ...timed(c, i), enter: axis, origin, dur: 0.5 };
  const fadeIn = (c: BridgeColumn, i: number): ElementFields =>
    motion === 'none' ? show : { ...timed(c, i), enter: 'fade', dur: 0.4 };
  const link = (i: number): ElementFields =>
    motion === 'none'
      ? show
      : { ...timed(cols[i + 1], i + 1), enter: 'draw', dur: 0.3 };
  const color = (c: BridgeColumn): string => bridgeColor(c, p.good);
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin);
  title.id = 'bridge-title';
  const elements: CanvasElement[] = [
    title,
    {
      id: 'bridge-unit',
      type: 'text',
      text: p.unit,
      x: L.margin,
      y: L.keyY + shift,
      size: L.keyType,
      fill: 'muted',
      font: 'semibold',
      fit: width - 2 * L.margin,
      ...show,
    },
  ];
  const top = L.top + shift,
    bottom = L.bottom;
  if (vertical) {
    verticalBridge({
      L,
      width,
      n,
      bottom,
      frac,
      top,
      font,
      cols,
      valueText,
      p,
      elements,
      tick,
      color,
      grow,
      fadeIn,
      link,
    });
  } else {
    // Rows read a bridge down the page. Wide frames keep the names in a column beside the bars; tall
    // frames put each name on a line above its bar so the bars keep the full width.
    horizontalBridge({
      width,
      height,
      cols,
      font,
      L,
      valueText,
      bottom,
      top,
      n,
      frac,
      p,
      tick,
      elements,
      color,
      grow,
      fadeIn,
      link,
    });
  }
  return elements;
}
