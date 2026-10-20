import { check } from './check.mjs';

export const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;

export const show = { at: 0, enter: 'none' };

// A layout estimate only (about half an em per character); the renderer measures the real glyphs,
// `fit` caps a line at its room, and the native frame audit is what proves nothing overflows.
export const textWidth = (value: unknown, size: number): number =>
  String(value).length * size * 0.56;

export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};

export const spoken = (v: unknown, name: string): void =>
  check(
    v == null || (typeof v === 'string' && v.trim() && v.length <= 40),
    `${name}.say is a word or short phrase from the narration`,
  );
