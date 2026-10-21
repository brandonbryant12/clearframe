import type { VerdictState } from './qa-verdict-state.mjs';

export function reportLength(state: VerdictState): string[] {
  const { mute, unvoiced, narrated, blank } = state;
  return [
    ...lengthLines(state),
    ...(mute
      ? [
          `  sound: ${unvoiced.length} of ${narrated.length} beats have narration but no voice, so the film plays their words in silence. Record it free with \`voice DIR --draft\`, or, for a recording (a podcast, an interview), import it with \`ingest DIR --audio FILE\` so the film plays the recording itself.`,
        ]
      : []),
    ...(blank.length ? ['  blank under the voice:', ...blank] : []),
  ];
}

function lengthLines({ sb, s, short, dropped }: VerdictState): string[] {
  if (sb.length && s.seconds < 0.75 * sb.length)
    return [
      `  length: ${Math.round(s.seconds)} s of the ${sb.length} s asked for${short ? ' (under 60%: not ready)' : ''}. Check BRIEF.md and EVIDENCE.md for the facts the film dropped and give each its own beat and picture (a longer film needs more pictures, not more words over the same ones)${short ? ': a reason in DIRECTION.md does not make it ready; only the person can ask for a shorter film' : ', or say in DIRECTION.md why it is shorter'}.`,
      ...(dropped.length
        ? [
            `  the source says, and the film never does (each could be a beat with its own picture):`,
            ...dropped.slice(0, 5).map((l) => `    "${l}"`),
          ]
        : []),
    ];
  if (sb.length && s.seconds > 1.3 * sb.length)
    return [
      `  length: ${Math.round(s.seconds)} s against the ${sb.length} s asked for: cut to the facts that matter.`,
    ];
  return [];
}
