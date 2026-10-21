import { isTarget } from './target.mjs';

import type { BeatState, ArtScheduler } from './job-beat-contracts.mjs';

import { canvasSources } from './job-beat-canvas-sources.mjs';
import { canvasBridge } from './job-beat-canvas-bridge.mjs';
import { canvasGround, canvasDepth } from './job-beat-canvas-motion.mjs';
export function prepareCanvasBeat(
  state: BeatState,
  scheduleArt: ArtScheduler,
): void {
  const { props, at } = state;
  canvasSources(state);
  state.settle = Math.max(
    state.settle,
    scheduleArt(props.elements, at, props.stagger ?? 0),
  );
  if (isTarget(props.viewFrom) && props.viewAt != null)
    state.settle = Math.max(
      state.settle,
      props.viewAt + (props.viewDur ?? 1.2),
    );
  canvasGround(state);
  canvasBridge(state);
  canvasDepth(state);
}
