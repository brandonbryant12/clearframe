export function valuationLabel(value: number | null, decimals: number): string {
  if (value === null) return '—';
  const fraction = decimals ? '.' + '0'.repeat(decimals) : '';
  return value.toFixed(decimals).replace(/^-0(\.0+)?$/, '0' + fraction);
}
