import type { JobBeat, ArtLayers, BeatLayers } from './types.mjs';

import { TRANSITIONS } from './catalog.mjs';

import { EXITS, retired } from './constants.mjs';

import type { keepPace } from './job-pace.mjs';

import { exitFor } from './job-exits.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function finishBeat(
  {
    b,
    source,
    props,
    timing,
    transitions,
    captions,
    frame,
    report,
    settle,
    motion,
    at,
  }: BeatState,
  art: ArtLayers | null,
  paced: ReturnType<typeof keepPace>,
  layers: BeatLayers,
): JobBeat {
  const transition = transitions[b.index];
  if (!TRANSITIONS.includes(transition))
    throw new Error(
      retired('transition', transition) ??
        `Unsupported native transition ${transition}; use ${TRANSITIONS.join(', ')}`,
    );
  const authoredExit = source.exit ?? 'auto';
  if (!EXITS.includes(authoredExit))
    throw new Error(
      retired('sceneExit', authoredExit) ?? `exit must be ${EXITS.join(', ')}`,
    );
  const startFrame = Math.round(b.start * timing.fps),
    frames = Math.round(b.end * timing.fps) - startFrame;
  // Something that arrives just before the cut is seen for a blink; viewers need ~0.5 s.
  const hold = frames / timing.fps - settle;
  if (
    hold >= 0 &&
    hold < 0.45 &&
    b.index < timing.beats.length - 1 &&
    b.block !== 'kinetic'
  )
    report.warnings.push(
      b.vo?.provider === 'imported'
        ? // A recording's beats cannot be lengthened without silence in the conversation.
          `${b.id}: the last element lands ${hold.toFixed(2)} s before the cut. Cue it on an earlier word, or let it carry into the next beat's picture.`
        : `${b.id}: the last element lands ${hold.toFixed(2)} s before the cut. Cue it earlier, or add hold/tail so it can be read.`,
    );
  return {
    id: b.id,
    block: b.block ?? '',
    frames,
    start_frame: startFrame,
    cue_seconds: paced?.cue ?? at,
    ...(paced ? { count_seconds: paced.count } : {}),
    transition,
    exit: exitFor(authoredExit, transitions[b.index + 1]),
    settle_seconds: Math.max(0, Math.min(settle, frames / timing.fps)),
    motion,
    props,
    ...(art ? { art } : {}),
    ...layers,
    words: (b.vo?.words ?? []).map((w) => ({
      text: w.w,
      start: Math.max(0, w.t0 - startFrame / timing.fps),
      end: Math.min(w.t1 - startFrame / timing.fps, frames / timing.fps),
    })),
    // A caption belongs to the beat it starts in; at a shared boundary (continuous takes),
    // rounding must not drop the next beat's first caption into this one with no length.
    captions: captions
      .filter(
        (c) => c.start >= b.start - frame / 2 && c.start < b.end - frame / 2,
      )
      .map((c) => ({
        start: Math.max(0, c.start - b.start),
        end: Math.min(c.end, b.end) - b.start,
        text: c.text,
        lines: c.lines,
      })),
  };
}
