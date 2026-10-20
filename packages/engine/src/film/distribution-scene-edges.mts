import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { text } from './distribution-scene-common.mjs';
export function distributionEdges(ctx: DistributionContext): void {
  const {
    w,
    id,
    focus,
    m,
    margin,
    size,
    left,
    right,
    bottom,
    stripTop,
    px,
    elements,
  } = ctx;
  for (const [i, v] of m.edges.entries())
    elements.push(
      text(`${id}-x-${i}`, v, px(v), bottom + size * 1.3, size * 0.9, {
        anchor: edgeAnchor(i, m.edges.length),
        font: 'figures',
        fit: ((right - left) / (m.edges.length - 1)) * 0.85,
      }),
    );
  elements.push(
    text(id + '-x-unit', m.unit, right, bottom + size * 2.5, size * 0.9, {
      anchor: 'end',
    }),
    text(
      id + '-strip-label',
      focus
        ? 'Outlined dots meet the threshold'
        : 'Each dot is one observed value',
      margin,
      stripTop - size * 0.7,
      size * 0.9,
      { fit: w - 2 * margin },
    ),
  );
}

function edgeAnchor(i: number, count: number): string {
  if (i === 0) return 'start';
  if (i === count - 1) return 'end';
  return 'middle';
}
