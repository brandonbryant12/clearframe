import type { ChartContext } from './data-canvas-contracts.mjs';
import { r, format } from './data-canvas-common.mjs';
import { noteElements } from './data-canvas-note.mjs';
export function chartStack(ctx: ChartContext): void {
  const { spec, w, h, at, stagger, values, tall, note, fill, when, out } = ctx;

  const [x, y, bw, bh] =
    spec.box ??
    (tall
      ? [w * 0.08, h * 0.42, w * 0.84, h * 0.1]
      : [w * 0.06, h * 0.4, w * 0.88, h * 0.15]);
  const total = values.reduce((a, v) => a + v.value, 0) || 1;
  let cx = x;
  values.forEach((v, i) => {
    const sw = (v.value / total) * bw,
      t = at + i * stagger;
    out.push({
      type: 'rect',
      id: v.key,
      x: r(cx),
      y: r(y),
      w: r(Math.max(sw - 4, 1)),
      h: r(bh),
      fill: fill(v),
      opacity: v.highlight ? 1 : 0.75,
      enter: 'grow-x',
      origin: [r(cx), r(y + bh / 2)],
      ...when(v, t),
      dur: 0.6,
    });
    if (sw > 190)
      out.push(
        {
          type: 'text',
          of: v.key,
          text: v.label,
          x: r(cx),
          y: r(y - 30),
          size: 36,
          fit: r(sw - 16),
          fill: v.highlight ? 'ink' : 'muted',
          ...when(v, t, 0.3),
          enter: 'fade',
          dur: 0.4,
        },
        {
          type: 'text',
          of: v.key,
          text: format(v.value, spec),
          x: r(cx),
          y: r(y + bh + 78),
          size: 64,
          font: 'figures',
          fill: 'ink',
          ...when(v, t, 0.4),
          enter: 'rise',
          dur: 0.4,
        },
      );
    else
      // Too narrow for its own label: name it on a second row above, ending at its right
      // edge, with a tick down to the segment, so no segment is left unnamed.
      out.push(
        {
          type: 'line',
          of: v.key,
          x1: r(cx + sw / 2),
          y1: r(y - 62),
          x2: r(cx + sw / 2),
          y2: r(y - 6),
          stroke: 'muted',
          width: 2,
          ...when(v, t, 0.3),
          enter: 'draw',
          dur: 0.3,
        },
        {
          type: 'text',
          of: v.key,
          text: `${v.label} ${format(v.value, spec)}`,
          x: r(cx + sw / 2 + 10),
          y: r(y - 74),
          size: 32,
          anchor: 'end',
          fill: v.highlight ? 'ink' : 'muted',
          ...when(v, t, 0.3),
          enter: 'fade',
          dur: 0.4,
        },
      );
    if (note && note.target === v)
      out.push(
        ...noteElements(note, cx + Math.min(sw, 120) / 2, y + bh + 170, {
          left: x,
          right: x + bw,
          up: true,
        }),
      );
    cx += sw;
  });
}
