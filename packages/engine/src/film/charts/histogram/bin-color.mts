export function binColor(qualifying: boolean, tone: string): string {
  if (!qualifying) return 'accent';
  return tone === 'negative' ? 'negative' : 'accent2';
}
