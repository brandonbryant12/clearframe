export function panelLabelColor(highlight: boolean, dim: boolean): string {
  if (highlight) return 'accent2';
  return dim ? 'muted' : 'ink';
}
