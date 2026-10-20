import { tokenize } from './timing.mjs';

import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatReading(ctx: BeatCheckContext): void {
  const { sb, t, add, b, i, d, words } = ctx;
  // A hold on a slice of an imported recording plays silence in the middle of the conversation.
  if (
    sb.beats[i]?.hold &&
    t[i]?.vo?.provider === 'imported' &&
    i < t.length - 1 &&
    t[i + 1]?.vo?.provider === 'imported'
  )
    add(
      'warn',
      b.id,
      `hold adds ${sb.beats[i].hold} s of silence inside the recording, between two things said. Let the picture move instead (a cue on a later word), or put the hold on the last beat.`,
    );
  kineticReading(ctx);
  if (d > 0 && words / d > 3.2 && b.block !== 'kinetic')
    add(
      'warn',
      b.id,
      `${words} words on screen for ${d.toFixed(1)} s (${(words / d).toFixed(1)}/s). Viewers read ~3 words a second while listening; cut the text or extend the beat.`,
    );
  if (b.vo && tokenize(b.vo).length > 40)
    add(
      'warn',
      b.id,
      'More than 40 spoken words in one beat. Split it: one idea per beat.',
    );
  if (
    ['stat', 'kpis', 'delta', 'bars', 'line'].includes(b.block ?? '') &&
    b.vo &&
    !b.props?.land &&
    !b.props?.growSay &&
    !b.props?.drawSay
  )
    add(
      'idea',
      b.id,
      'The number is not cued to a word. Set land/growSay to the stressed word so the picture lands with the voice.',
    );
}

function kineticReading({ b, d, add }: BeatCheckContext): void {
  // Speech-following type that changes faster than anyone reads: one word at a time, or
  // two-word groups, across a whole passage. Fine for a few seconds of emphasis.
  if (b.block === 'kinetic' && d > 5) {
    const mode = b.props?.mode ?? 'highlight',
      maxWords = typeof b.props?.maxWords === 'number' ? b.props.maxWords : 6,
      group = mode === 'word' ? 1 : maxWords,
      spoken = String(b.vo ?? '')
        .split(/\s+/)
        .filter(Boolean).length,
      each = spoken ? (d * Math.min(group, spoken)) / spoken : d;
    if (each < 0.9)
      add(
        'warn',
        b.id,
        `${mode === 'word' ? 'One word at a time' : `${group}-word phrases`} for ${d.toFixed(1)} s: the type changes every ${each.toFixed(1)} s, faster than a viewer reads. Keep that for a few seconds of emphasis; for a passage use mode "highlight" with maxWords 6–8 (a stable phrase that lights up as it is spoken), or give the passage a picture and let captions carry the words.`,
      );
  }
}
