export function phaseValue(value: number | null, decimals: number) {
  if (value === null) return 'missing';
  const s = value.toFixed(decimals).replace(/^-0(?=\.0+$|$)/, '0');
  return (Number(s) === value ? '' : '≈') + s;
}
