import { axisLabel, type AxisFormat } from './plot-data.mjs';
import type { CanvasElement, ElementFields } from './types.mjs';
export function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`small multiples: ${m}`);
}
export const show = { at: 0, enter: 'none' };
export function rankLabel(value: number, axis: AxisFormat): string {
  let decimals = axis.decimals ?? 0;
  while (decimals < 6 && Number(value.toFixed(decimals)) !== value) decimals++;
  const approximate = Number(value.toFixed(decimals)) !== value;
  return `${approximate ? '≈' : ''}${axisLabel(value, { ...axis, decimals })}`;
}
export const text = (
  id: string,
  value: unknown,
  x: number,
  y: number,
  size: number,
  extra: ElementFields = {},
): CanvasElement => ({
  id,
  type: 'text',
  text: String(value),
  x,
  y,
  size,
  fill: 'ink',
  font: 'text',
  ...show,
  ...extra,
});
export const line = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  extra: ElementFields = {},
): CanvasElement => ({
  id,
  type: 'line',
  x1,
  y1,
  x2,
  y2,
  stroke: 'line',
  width: 1,
  ...show,
  ...extra,
});
