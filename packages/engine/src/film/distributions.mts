import { type DistributionModel } from './distribution-data.mjs';
import type { BlockProps } from './types.mjs';
import type {
  DistributionGeometry,
  DistributionSceneOptions,
} from './distribution-scene-contracts.mjs';

export type {
  DistributionGeometry,
  DistributionSceneOptions,
} from './distribution-scene-contracts.mjs';
export { thresholdLabel } from './distribution-scene-common.mjs';
import { distributionContext } from './distribution-scene-context.mjs';
import { distributionHeading } from './distribution-scene-heading.mjs';
import { distributionGrid } from './distribution-scene-grid.mjs';
import { distributionBars } from './distribution-scene-bars.mjs';
import { distributionEdges } from './distribution-scene-edges.mjs';
import { distributionThreshold } from './distribution-scene-threshold.mjs';
import { distributionSamples } from './distribution-scene-samples.mjs';
import { distributionFooter } from './distribution-scene-footer.mjs';
export function distributionScene(
  input: unknown,
  options: DistributionSceneOptions,
): {
  model: DistributionModel;
  geometry: DistributionGeometry;
  props: BlockProps;
} {
  const ctx = distributionContext(input, options);
  distributionHeading(ctx);
  distributionGrid(ctx);
  distributionBars(ctx);
  distributionEdges(ctx);
  distributionThreshold(ctx);
  distributionSamples(ctx);
  distributionFooter(ctx);
  const { model, geometry, w, h, sourceId, elements } = ctx;
  return {
    model,
    geometry,
    props: { view: [0, 0, w, h], sourceElement: sourceId, elements },
  };
}
