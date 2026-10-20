import type { CanvasElement, ElementFields } from '../../types.mjs';
import type { PlotLayout } from './contracts.mjs';
import { titleLines } from './title-lines.mjs';

export const show = { at: 0, enter: 'none' };

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
  width: 1.5,
  ...show,
  ...extra,
});

export const text = (
  id: string,
  value: string,
  x: number,
  y: number,
  size: number,
  extra: ElementFields = {},
): CanvasElement => ({
  id,
  type: 'text',
  text: value,
  x,
  y,
  size,
  fill: 'ink',
  font: 'text',
  ...show,
  ...extra,
});

export const colors = ['accent', 'accent2', 'ink', 'muted'];

// Rough advance width of tabular figures and UI text, for spacing checks only.
export const textWidth = (value: unknown, size: number): number =>
  String(value).length * size * 0.56;

// Dots read as observations on short series; on long ones they turn a line into beads.
export const DOT_LIMIT = 16;

export const titleShift = (
  title: string,
  L: PlotLayout,
  width: number,
): number => (titleLines(title, L, width) - 1) * L.titleType * 1.2;
