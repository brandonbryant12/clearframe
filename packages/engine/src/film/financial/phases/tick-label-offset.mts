export function tickLabelOffset(index: number, count: number, length: number) {
  if (index === 0) return 0;
  return index === count - 1 ? length : length / 2;
}
