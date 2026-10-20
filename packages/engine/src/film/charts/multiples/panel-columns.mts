export function panelColumns(tall: boolean, count: number): number {
  if (tall) return 2;
  return count <= 4 ? count : 3;
}
