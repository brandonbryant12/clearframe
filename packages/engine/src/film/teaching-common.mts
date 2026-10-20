import type { CanvasElement, ElementFields } from './types.mjs';
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`teaching: ${message}`);
}
export const show = { at: 0, enter: 'none' };
export function copy(
  value: unknown,
  field: string,
  max: number,
  optional = false,
): string {
  if (value == null && optional) return '';
  check(
    typeof value === 'string' && value.trim() && value.length <= max,
    `${field} must be nonempty text up to ${max} characters`,
  );
  return value;
}
export const text = (
  id: string,
  value: string,
  x: number,
  y: number,
  size: number,
  width: number,
  extra: ElementFields = {},
): CanvasElement => ({
  type: 'text',
  id,
  text: value,
  x,
  y,
  size,
  width,
  leading: 1.15,
  font: 'display',
  fill: 'ink',
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
  type: 'line',
  id,
  x1,
  y1,
  x2,
  y2,
  stroke: 'muted',
  width: 2,
  ...show,
  ...extra,
});
export interface TeachingBase {
  phase: 'question' | 'answer';
  prompt: string;
  explanation: string;
  source: string;
  layout: 'full' | 'split';
  motion: 'fade' | 'none';
  revealAt: number;
  explainAt: number;
}
export type Teaching = TeachingBase &
  (
    | { form: 'choice'; options: string[]; correctIndex: number }
    | { form: 'gap'; before: string; answer: string; after: string }
  );
