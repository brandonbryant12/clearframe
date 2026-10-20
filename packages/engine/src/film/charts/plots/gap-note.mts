import { type AxisValue } from '../../plot-data.mjs';

export function gapNote(missing: readonly AxisValue[]): string {
  if (!missing.length) return '';
  return `Gap: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? '…' : ''}.`;
}
