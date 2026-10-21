import type { ChartContext } from './data-canvas-contracts.mjs';
import { r, format } from './data-canvas-common.mjs';
import { noteElements } from './data-canvas-note.mjs';
export function chartSequence(ctx: ChartContext): boolean {
  const { spec, w, h, values, note, out } = ctx;
  const cued = values.filter((x) => x.say);
  if (cued.length <= 1) return false;
  const [x, y, bw, bh] = spec.box ?? [w * 0.15, h * 0.24, w * 0.7, h * 0.48];
  const max = spec.max ?? (Math.max(...cued.map((c) => c.value)) || 1),
    size = Math.round(Math.min(bh * 0.6, 300)),
    fy = y + bh * 0.55,
    barY = fy + size * 0.3 + 100;
  cued.forEach((v, i) => {
    const next = cued[i + 1];
    // Each figure leaves on the next one's word and the next arrives as it has gone, so two
    // figures never share the spot (the first may start a moment before its word).
    const leave = next ? { exit: 'fade', exitSay: next.say, exitDur: 0.2 } : {},
      wait = i > 0 ? { after: 0.2 } : {};
    out.push(
      {
        type: 'text',
        text: format(v.value, spec),
        x: r(x + bw / 2),
        y: r(fy),
        size,
        fit: r(bw),
        font: 'figures',
        anchor: 'middle',
        fill: v.highlight ? 'accent' : 'ink',
        say: v.say,
        ...wait,
        enter: 'rise',
        dur: 0.5,
        ...leave,
      },
      {
        type: 'text',
        text: v.label,
        x: r(x + bw / 2),
        y: r(fy + size * 0.3 + 54),
        size: 44,
        fit: r(bw),
        anchor: 'middle',
        fill: 'muted',
        say: v.say,
        after: i > 0 ? 0.3 : 0.2,
        enter: 'fade',
        dur: 0.4,
        ...leave,
      },
    );
  });
  // One bar that follows the figure: it starts at the first value and resizes on each word.
  const first = cued[0];
  out.push({
    type: 'rect',
    id: first.key,
    x: r(x),
    y: r(barY),
    w: r(bw),
    h: 18,
    fill: 'accent',
    enter: 'grow-x',
    origin: [r(x), r(barY + 9)],
    say: first.say,
    after: 0.3,
    dur: 0.6,
    keys: [
      { say: first.say, dur: 0, scaleX: first.value / max },
      ...cued.slice(1).map((v) => ({
        say: v.say,
        after: 0.2,
        dur: 0.6,
        scaleX: v.value / max,
      })),
    ],
  });
  // The note annotates the bar under the stepping figure (it was dropped on this path).
  if (note)
    out.push(
      ...noteElements(note, x + bw / 2, barY + 60, { left: x, right: x + bw }),
    );
  return true;
}
