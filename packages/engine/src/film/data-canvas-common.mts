import type { ChartFormat } from './types.mjs';
export const slug = (s: unknown): string =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'v';
export const r = (v: number): number => Math.round(v * 10) / 10;

export function format(
  v: number,
  { prefix = '', suffix = '', decimals }: ChartFormat,
): string {
  const d = decimals ?? (Number.isInteger(v) ? 0 : 1);
  return `${prefix}${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
}
