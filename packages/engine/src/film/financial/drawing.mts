import type { CanvasElement } from '../types.mjs';
export const show = { at: 0, enter: 'none' };
export const text = (
  id: string,
  value: string | number,
  x: number,
  y: number,
  size: number,
  extra: Partial<CanvasElement> = {},
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
  extra: Partial<CanvasElement> = {},
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
export const rect = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<CanvasElement> = {},
): CanvasElement => ({
  id,
  type: 'rect',
  x,
  y,
  w,
  h,
  r: 0,
  fill: 'accent',
  ...show,
  ...extra,
});
export function edgeAnchor(
  index: number,
  count: number,
): 'start' | 'end' | 'middle' {
  if (index === 0) return 'start';
  return index === count - 1 ? 'end' : 'middle';
}
