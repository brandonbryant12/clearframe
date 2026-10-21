import type { ChartContext } from './data-canvas-contracts.mjs';
import { r, format } from './data-canvas-common.mjs';
import { noteElements } from './data-canvas-note.mjs';
export function chartNumber(ctx: ChartContext): void {
  const { spec, w, h, at, values, note, out } = ctx;
  const v = values.find((x) => x.highlight) ?? values[0];
  const [x, y, bw, bh] = spec.box ?? [w * 0.15, h * 0.24, w * 0.7, h * 0.48];
  const max = spec.max ?? v.value,
    size = Math.round(Math.min(bh * 0.6, 300));
  out.push(
    {
      type: 'text',
      text: format(v.value, spec),
      x: r(x + bw / 2),
      y: r(y + bh * 0.55),
      size,
      fit: r(bw),
      font: 'figures',
      anchor: 'middle',
      fill: 'ink',
      // A figure with a word lands on it; its label and empty track hold the frame until then.
      ...(v.say ? { say: v.say } : { at }),
      enter: 'rise',
      dur: 0.6,
    },
    {
      type: 'text',
      text: v.label,
      x: r(x + bw / 2),
      // Below the figure's descenders.
      y: r(y + bh * 0.55 + size * 0.3 + 54),
      size: 44,
      fit: r(bw),
      anchor: 'middle',
      fill: 'muted',
      at: r(at + 0.3),
      enter: 'fade',
      dur: 0.5,
    },
    // A zero ("your balance: $0") is an empty track rather than a bar of no width.
    max > 0 && v.value > 0
      ? {
          type: 'rect',
          id: v.key,
          x: r(x),
          y: r(y + bh * 0.55 + size * 0.3 + 100),
          w: r((v.value / max) * bw),
          h: 18,
          fill: 'accent',
          enter: 'grow-x',
          origin: [r(x), r(y + bh * 0.55 + size * 0.3 + 109)],
          ...(v.say ? { say: v.say, after: 0.3 } : { at: r(at + 0.5) }),
          dur: 0.7,
        }
      : {
          type: 'rect',
          id: v.key,
          x: r(x),
          y: r(y + bh * 0.55 + size * 0.3 + 100),
          w: r(bw),
          h: 18,
          fill: 'none',
          stroke: 'muted',
          width: 2,
          enter: 'fade',
          at: r(at + 0.5),
          dur: 0.5,
        },
  );
  if (note)
    out.push(
      ...noteElements(note, x + bw / 2, y + bh * 0.55 + size * 0.3 + 150, {
        left: x,
        right: x + bw,
      }),
    );
}
