import { plotLayout, titleText, titleShift } from '../../plots.mjs';

import type { CanvasElement, ElementFields, FrameSize } from '../../types.mjs';
import type { BarsSpec, BarValue } from './contracts.mjs';
import { show, textWidth } from './primitives.mjs';
import { barColor } from './bar-color.mjs';
import { check } from './check.mjs';
import { verticalBars } from './vertical-bars.mjs';
import { horizontalBars } from './horizontal-bars.mjs';

export function barsElements(p: BarsSpec, frame: FrameSize): CanvasElement[] {
  const { width } = frame,
    L = plotLayout(frame),
    font = L.type,
    vertical = p.orientation === 'vertical';
  const fmt = (v: number): string =>
    `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const [lo, hi] = p.domain,
    frac = (v: number): number => (v - lo) / (hi - lo);
  const motion = p.motion;
  const n = p.values.length,
    end = motion === 'none' ? 0 : motion.at + motion.duration;
  const arrive = (at: number): ElementFields =>
    at === 0 ? show : { at, enter: 'fade', dur: 0.3 };
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  // Horizontal bars need room for category names on the left.
  const left = vertical
    ? L.left
    : L.margin +
      Math.min(
        width * 0.26,
        Math.max(...p.values.map((v) => textWidth(v.label, font))) + font,
      );
  const right = vertical ? L.right : L.right + width * 0.02,
    top = L.top + shift,
    bottom = L.bottom;
  const color = (v: BarValue): string => barColor(v, p.colors);
  const title = titleText(p.title, L, width - 2 * L.margin);
  title.id = 'bars-title';
  const elements: CanvasElement[] = [
    title,
    {
      id: 'bars-unit',
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
  const slot = (vertical ? right - left : bottom - top) / n,
    thickness = slot * (vertical ? 0.62 : 0.58);
  check(
    thickness >= font * 0.5,
    'too many bars for this frame; aggregate or use a line plot',
  );
  if (vertical) {
    verticalBars({
      bottom,
      frac,
      top,
      p,
      font,
      elements,
      left,
      right,
      fmt,
      L,
      slot,
      motion,
      n,
      thickness,
      color,
      arrive,
      end,
      width,
    });
  } else {
    horizontalBars({
      left,
      frac,
      right,
      p,
      fmt,
      font,
      elements,
      top,
      bottom,
      slot,
      motion,
      n,
      thickness,
      color,
      L,
      arrive,
      end,
    });
  }
  return elements;
}
