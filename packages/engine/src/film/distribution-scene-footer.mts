import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { text } from './distribution-scene-common.mjs';
export function distributionFooter(ctx: DistributionContext): void {
  const { w, h, id, focus, m, tall, margin, elements, sourceId } = ctx;
  elements.push(
    text(
      id + '-limit',
      focus
        ? 'Observed sample share · not a forecast'
        : `Bins include left edge; last includes both · ${m.missing} missing`,
      margin,
      h * (tall ? 0.855 : 0.885),
      w * (tall ? 0.029 : 0.022),
      { fit: w - 2 * margin },
    ),
    text(
      sourceId,
      `${m.source} ${m.asOf}.`,
      margin,
      h * (tall ? 0.915 : 0.935),
      w * (tall ? 0.028 : 0.023),
      { width: w - 2 * margin, height: h * 0.055 },
    ),
  );
}
