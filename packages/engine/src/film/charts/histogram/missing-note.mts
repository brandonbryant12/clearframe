export function missingNote(count: number): string {
  if (!count) return '';
  return ` ${count} missing observation${count > 1 ? 's' : ''} excluded.`;
}
