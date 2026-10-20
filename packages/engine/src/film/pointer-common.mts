import type { Point, PointerStep } from './types.mjs';
// The cursor's outline with its tip at (0, 0), 40 units tall (the macOS arrow's proportions).
export const ARROW =
  'M 0 0 L 0 40 L 10.5 30.5 L 17 46 L 25 43 L 18.5 28 L 31 28 Z';
export const POINTER_FIELDS = [
  'to',
  'steps',
  'from',
  'point',
  'press',
  'style',
  'size',
  'leave',
  'sound',
];
export const STEP_FIELDS = ['to', 'say', 'at', 'press', 'point'];

export const isPoint = (v: unknown): v is Point =>
  Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);

export const when = (
  s: PointerStep,
  offset = 0,
): { say: string; after: number } | { at: number } =>
  s.say != null
    ? { say: s.say, after: offset }
    : { at: Math.max(0, (s.at ?? 0) + offset) };
export const travel = (a: number[], b: number[]): number =>
  Math.min(1.1, Math.max(0.55, Math.hypot(b[0] - a[0], b[1] - a[1]) / 1100));
