export function findingIcon(level: string): string {
  if (level === 'error') return '✗';
  if (level === 'warn') return '!';
  return '·';
}
export function findingLocation(finding: {
  t?: number;
  beat?: string;
  kind?: string;
}): string {
  if (finding.t == null) return finding.kind ?? '';
  const beat = finding.beat ? ` ${finding.beat}` : '';
  return `${finding.t}s${beat}`;
}
