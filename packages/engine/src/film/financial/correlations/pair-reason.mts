import type { CorrelationCell } from '../../correlation-data.mjs';

export function pairReason(cell: CorrelationCell) {
  if (cell.reason === 'insufficient-pairs') return 'too few pairs';
  return cell.reason === 'zero-variance'
    ? 'constant series'
    : 'descriptive only';
}
