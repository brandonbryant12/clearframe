import type { Checkpoint } from './checkpoints-contracts.mjs';
import type { CheckpointState } from './checkpoints-state.mjs';

export function storyCheckpoint(state: CheckpointState): Checkpoint {
  const { sb, decided, spine } = state;
  return {
    id: 'story',
    name: 'Story and look',
    ask: true,
    done:
      (spine && !!(sb.treatment || sb.lens || typeof sb.theme === 'object')) ||
      decided('Story', 'Look', 'Spine'),
    detail: `${sb.treatment ? `treatment ${sb.treatment}` : 'no treatment'}; spine ${spine ? 'written' : 'not written'}`,
    question:
      'Does the story spine (question, turn, payoff) and the look fit what you want?',
  };
}
