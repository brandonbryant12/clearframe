import { check } from './check.mjs';

export const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;

export const show = { at: 0, enter: 'none' };

export const textWidth = (value: unknown, size: number): number =>
  String(value).length * size * 0.56;

export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};
