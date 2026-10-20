export function cellStroke(selected: boolean, onSlice: boolean) {
  if (selected) return 4;
  return onSlice ? 2 : 1;
}
