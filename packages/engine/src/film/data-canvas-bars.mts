import type { ChartContext } from './data-canvas-contracts.mjs';
import { r, format } from './data-canvas-common.mjs';
import { noteElements } from './data-canvas-note.mjs';
export function chartBars(ctx: ChartContext): void {
  const { spec, w, h, at, stagger, values, tall, note, fill, when, out } = ctx;

  // The finding fills the frame: no heading underneath, the narration names it. Its labels
  // and note stay above the caption band at the foot of the frame.
  const [x, y, bw, bh] =
    spec.box ??
    (tall
      ? [w * 0.1, h * 0.26, w * 0.8, h * 0.4]
      : [w * 0.1, h * 0.14, w * 0.8, h * 0.5]);
  const max = spec.max ?? Math.max(...values.map((v) => v.value), 1);
  const n = values.length,
    col = bw / (n + (n - 1) * 0.45),
    base = y + bh;
  out.push({
    type: 'line',
    x1: r(x),
    y1: r(base),
    x2: r(x + bw),
    y2: r(base),
    stroke: 'line',
    width: 2,
    at,
    dur: 0.5,
    enter: 'draw',
  });
  values.forEach((v, i) => {
    const cx = x + i * col * 1.45,
      hv = (v.value / max) * bh,
      t = at + i * stagger;
    out.push(
      {
        type: 'rect',
        id: v.key,
        x: r(cx),
        y: r(base - hv),
        w: r(col),
        h: r(Math.max(hv, 1)),
        fill: fill(v),
        opacity: v.highlight ? 1 : 0.75,
        enter: 'grow-y',
        origin: [r(cx + col / 2), r(base)],
        ...when(v, t),
        dur: 0.7,
      },
      {
        type: 'text',
        of: v.key,
        text: format(v.value, spec),
        x: r(cx + col / 2),
        y: r(base - hv - 22),
        size: Math.round(Math.min(84, Math.max(40, col * 0.34))),
        font: 'figures',
        anchor: 'middle',
        fill: 'ink',
        ...when(v, t, 0.4),
        enter: 'rise',
        dur: 0.4,
      },
      {
        type: 'text',
        of: v.key,
        text: v.label,
        x: r(cx + col / 2),
        y: r(base + 56),
        size: 36,
        fit: r(col * 1.4),
        anchor: 'middle',
        fill: v.highlight ? 'ink' : 'muted',
        ...when(v, t, 0.2),
        enter: 'fade',
        dur: 0.4,
      },
    );
    if (note && note.target === v)
      out.push(
        ...noteElements(note, cx + col / 2, base + 130, {
          left: x,
          right: x + bw,
          up: true,
        }),
      );
  });
}
