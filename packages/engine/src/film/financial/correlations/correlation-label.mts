import type { CorrelationCell } from '../../correlation-data.mjs';
export function correlationLabel(c: Pick<CorrelationCell, 'value'>): string {
  if (c.value === null) return '—';
  const sign = c.value > 0 ? '+' : '';
  return `${sign}${c.value.toFixed(2).replace(/^-0\.00$/, '0.00')}`;
}
