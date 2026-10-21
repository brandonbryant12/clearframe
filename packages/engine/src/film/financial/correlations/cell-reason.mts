import type { CorrelationCell } from '../../correlation-data.mjs';

export function cellReason(cell: CorrelationCell) {
  if (cell.reason === 'insufficient-pairs') return `n=${cell.n} · few`;
  return cell.reason === 'zero-variance'
    ? `n=${cell.n} · flat`
    : `n = ${cell.n}`;
}
