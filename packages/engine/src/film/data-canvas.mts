import type { CanvasElement } from './types.mjs';
import type { ChartSpec } from './data-canvas-contracts.mjs';

export type {
  ChartValue,
  ChartNote,
  ChartSpec,
} from './data-canvas-contracts.mjs';
export { chartSpec } from './data-canvas-spec.mjs';
import { chartContext } from './data-canvas-context.mjs';
import { chartBars } from './data-canvas-bars.mjs';
import { chartStack } from './data-canvas-stack.mjs';
import { chartNumber } from './data-canvas-number.mjs';
import { chartSequence } from './data-canvas-sequence.mjs';
import { finishChart } from './data-canvas-finish.mjs';
export function chartElements(
  spec: ChartSpec,
  frame: { w: number; h: number },
): CanvasElement[] {
  const ctx = chartContext(spec, frame);
  if (ctx.spec.kind === 'bars') chartBars(ctx);
  else if (ctx.spec.kind === 'stack') chartStack(ctx);
  else if (chartSequence(ctx)) return ctx.out;
  else chartNumber(ctx);
  finishChart(ctx);
  return ctx.out;
}
