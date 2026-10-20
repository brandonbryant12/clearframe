import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

import { narrationDetail } from './checkpoints-details.mjs';
export function scriptCheckpoint(state: CheckpointState): Checkpoint {
  const { narrated, pending, decided, drafted } = state;
  return {
    id: 'script',
    name: 'Narration',
    ask: true,
    // A one-shot film without a budget closes on the free draft voice and a logged decision.
    done:
      narrated > 0 &&
      (pending.filter((r) => r.kind === 'voice').length === 0 ||
        (drafted && decided('Narration', 'Script'))),
    detail: `${narrated} narrated beat(s); ${narrationDetail(state)}`,
    question:
      'Read the narration aloud: are these the words, before the voice is recorded?',
  };
}
