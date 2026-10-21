import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { check, text, show } from './distribution-scene-common.mjs';
export function distributionBars(ctx: DistributionContext): void {
  const { id, reveal, m, size, bottom, px, py, elements, labels, geometry } =
    ctx;
  for (const b of m.bins) {
    const x = px(b.low),
      y = py(b.height),
      bw = px(b.high) - x,
      bh = bottom - y,
      at = reveal ? 0.4 + b.index * 0.16 : 0,
      dur = reveal ? 0.8 : 0;
    check(bw >= 12, 'bins too narrow for this frame');
    check(
      !b.count || bh >= 1,
      'positive bars must occupy at least one native pixel; choose a tighter y maximum',
    );
    if (b.count)
      elements.push({
        id: `${id}-bar-${b.index}`,
        type: 'rect',
        x,
        y,
        w: bw,
        h: bh,
        fill: 'accent',
        stroke: 'bg',
        width: 1,
        ...show,
        ...(reveal
          ? {
              origin: [x, bottom],
              keys: [
                { at: 0, scaleY: 0, dur: 0 },
                { at, scaleY: 1, dur, ease: 'linear' },
              ],
            }
          : {}),
      });
    const labelY = (b.count ? y : bottom) - size * 0.35,
      labelWidth = Math.min(
        bw * 0.92,
        size * 0.85 * (`n=${b.count}`.length * 0.65 + 0.4),
      );
    labels.push(
      {
        id: `${id}-count-bg-${b.index}`,
        type: 'rect',
        x: x + bw / 2 - labelWidth / 2,
        y: labelY - size * 0.85,
        w: labelWidth,
        h: size * 1.05,
        fill: 'bg',
        ...show,
        at: at + dur,
      },
      text(
        `${id}-count-${b.index}`,
        `n=${b.count}`,
        x + bw / 2,
        labelY,
        size * 0.85,
        { anchor: 'middle', font: 'figures', fit: bw * 0.92, at: at + dur },
      ),
    );
    geometry.bars.push({ ...b, box: [x, y, bw, bh], at, end: at + dur });
  }
}
