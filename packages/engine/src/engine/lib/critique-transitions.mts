import type { CritiqueContext } from './critique-contracts.mjs';

export function checkTransitions(ctx: CritiqueContext) {
  const { sb, beats, add } = ctx;
  // Transitions.
  const transitions = beats.map((b) =>
    b.into != null ? 'into' : (b.transition ?? sb.transition ?? 'cut'),
  );
  const graphic = transitions.filter(
    (x) => x === 'panel' || x === 'wipe',
  ).length;
  if (beats.length >= 6 && new Set(transitions.slice(1)).size === 1)
    add(
      'idea',
      'film',
      `Every cut is a ${transitions[1]}. Mark the story's turns: go into an element of the last scene (into: its id), push to the next step, or move the camera through one world; cut within a sequence.`,
    );
  if (graphic > Math.max(2, beats.length / 3))
    add(
      'warn',
      'film',
      `${graphic} graphic transitions in ${beats.length} scenes. Reserve them for turns, or they stop meaning anything.`,
    );
  const tones = beats.filter((b) => b.tone && b.tone !== 'none').length;
  if (tones > Math.max(2, beats.length / 4))
    add(
      'warn',
      'film',
      `${tones} colour-blocked scenes. Punctuation works when it is rare.`,
    );
  return { transitions, graphic, tones };
}
