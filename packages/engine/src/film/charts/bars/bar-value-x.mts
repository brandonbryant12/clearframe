export function barValueX(
  value: number,
  x: number,
  font: number,
  outside: boolean,
  zero: number,
): number {
  if (value >= 0) return x + font * 0.5;
  return outside ? x - font * 0.5 : zero + font * 0.5;
}
