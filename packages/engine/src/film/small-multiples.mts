import type { MultipleSceneOptions } from './multiple-scene-contracts.mjs';

export type {
  MultipleLayout,
  MultiplePoint,
  MultipleSceneOptions,
} from './multiple-scene-contracts.mjs';
export { multipleLayout } from './multiple-scene-layout.mjs';
export { rankLabel } from './multiple-scene-common.mjs';
import { multipleContext } from './multiple-scene-context.mjs';
import { multiplePanelContext } from './multiple-scene-panel-context.mjs';
import { multipleHeading } from './multiple-scene-heading.mjs';
import { multipleAxes } from './multiple-scene-axes.mjs';
import { multiplePoints } from './multiple-scene-points.mjs';
import { multipleFocus } from './multiple-scene-focus.mjs';
import { multipleFooter } from './multiple-scene-footer.mjs';
export function multipleScene(input: unknown, options: MultipleSceneOptions) {
  const ctx = multipleContext(input, options);
  for (const [i, s] of ctx.model.panels.entries()) {
    const panel = multiplePanelContext(ctx, s, i);
    multipleHeading(panel);
    multipleAxes(panel);
    multiplePoints(panel);
    multipleFocus(panel);
  }
  const sourceId = multipleFooter(ctx);
  const { model, L, local, geometry, width, height, elements } = ctx;
  return {
    model,
    layout: L,
    local,
    geometry,
    props: { view: [0, 0, width, height], sourceElement: sourceId, elements },
  };
}
