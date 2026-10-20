export function basketRowStride(tall: boolean, count: number): number {
  if (count !== 4) return 0.085;
  return tall ? 0.065 : 0.067;
}
