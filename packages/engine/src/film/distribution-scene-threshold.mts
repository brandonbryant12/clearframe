import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { line } from './distribution-scene-common.mjs';
export function distributionThreshold(ctx: DistributionContext): void {
  const {
    id,
    focus,
    m,
    top,
    bottom,
    stripTop,
    stripBottom,
    r,
    px,
    elements,
    labels,
    geometry,
  } = ctx;
  // Deterministic collision packing preserves x exactly. Y is only separation,
  // not a second quantity. Reject cramped frames instead of silently overlapping.
  if (focus) {
    const x = px(m.threshold.value),
      threshold = {
        x,
        segments: [
          [top, bottom],
          [stripTop - r * 1.5, stripBottom],
        ],
        at: 0.2,
        end: 1,
      };
    geometry.threshold = threshold;
    for (const [i, [y1, y2]] of threshold.segments.entries())
      elements.push(
        line(`${id}-threshold-${i}`, x, y1, x, y2, {
          stroke: 'ink',
          width: 2,
          at: 0.2,
          enter: 'draw',
          dur: 0.8,
          drawEase: 'linear',
        }),
      );
  }
  elements.push(...labels);
}
