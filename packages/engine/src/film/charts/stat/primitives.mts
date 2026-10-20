import { check } from './check.mjs';

export const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;

export const show = { at: 0, enter: 'none' };

export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};

export const affix = (v: unknown, name: string): string => {
  check(
    v == null || (typeof v === 'string' && v.length <= 8),
    `${name} must be text up to 8 characters`,
  );
  return v ?? '';
};

export const number = (v: number, decimals: number): string =>
  Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
