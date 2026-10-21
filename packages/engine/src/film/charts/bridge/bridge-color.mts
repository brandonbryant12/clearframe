import type { BridgeColumn } from './contracts.mjs';

export function bridgeColor(column: BridgeColumn, good: string): string {
  if (column.kind === 'end') return 'accent2';
  if (column.kind !== 'step') return 'muted';
  return column.value > 0 === (good === 'up') ? 'accent' : 'negative';
}
