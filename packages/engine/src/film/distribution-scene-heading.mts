import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { text, thresholdLabel } from './distribution-scene-common.mjs';
export function distributionHeading(ctx: DistributionContext): void {
  const { w, h, id, focus, m, tall, margin, size, elements } = ctx;
  elements.push(
    text(
      id + '-title',
      m.title,
      margin,
      h * (tall ? 0.09 : 0.115),
      w * (tall ? 0.047 : 0.034),
      { font: 'display', width: w - 2 * margin, height: h * 0.08 },
    ),
    text(
      id + '-summary',
      focus
        ? `${m.threshold.count} of ${m.n} observed ${thresholdLabel(m.threshold)} ${m.unit}`
        : `${m.n} observed · ${m.missing} missing · explicit bins`,
      margin,
      h * (tall ? 0.165 : 0.205),
      w * (tall ? 0.035 : 0.028),
      { font: 'figures', fit: w - 2 * margin },
    ),
    text(
      id + '-measure',
      m.mode === 'count'
        ? 'Bin height = count'
        : `Area = share · density per ${m.unit}`,
      margin,
      h * (tall ? 0.24 : 0.275),
      size,
      { fit: w - 2 * margin },
    ),
  );
}
