import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

import { spendDetail } from './checkpoints-details.mjs';
export function spendCheckpoint(state: CheckpointState): Checkpoint {
  const { pending, owed, decided } = state;
  return {
    id: 'spend',
    name: 'Spend',
    ask: true,
    done: owed === 0 || decided('Spend', 'Budget'),
    detail: spendDetail(state),
    question: `Approve about $${owed.toFixed(2)} for ${[...new Set(pending.map((r) => r.kind))].join(', ') || 'generation'}?`,
  };
}
