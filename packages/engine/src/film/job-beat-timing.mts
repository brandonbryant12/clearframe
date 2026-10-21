import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps } from './types.mjs';

import { type BeatContext } from './job-types.mjs';

import { ENTRANCE } from './constants.mjs';

import { cueResolver } from './job-cues.mjs';

import { validMotion } from './job-lens.mjs';

import { stageItems } from './job-stage.mjs';

import type { BeatBasics } from './job-beat-contracts.mjs';

export function beatTiming(
  b: TimingBeat,
  { film }: BeatContext,
  { source, spec, frame }: BeatBasics,
  props: BlockProps,
) {
  const motion = { ...film.motion, ...source.motion };
  if (!validMotion(motion)) throw new Error('Invalid beat motion');
  const entrance = ENTRANCE[motion.preset];
  const cue = cueResolver(b, frame);
  const authored = props.land ?? props.growSay ?? props.drawSay;
  // Headlines start almost immediately; data scenes leave a moment for the header. A count
  // cued to a spoken word pre-rolls so the figure lands on the word instead of starting there.
  let at = cue(authored, spec.cueDelay);
  if (spec.preroll && typeof authored === 'string')
    at = Math.max(0, at - spec.preroll);
  if (props.focus && b.block === 'bars')
    props.focus.at = cue(props.focus.say, at + 1.6);
  if (props.focus && b.block === 'annotate')
    props.focus.at = cue(props.focus.say, at + 0.4);
  if (spec.staged)
    stageItems(props, spec.staged, { b, frame, at, authored, cue, entrance });
  let settle = spec.settle(props, at, entrance, spec);
  // Word, letter and cascade reveals of display type (mirrors pieces() in scenes.rs).
  const textMotion = source.textMotion ?? film.textMotion;
  const display = String(
    props.text ?? (spec.hero || b.block === 'chapter' ? props.title : '') ?? '',
  );
  if (textMotion !== 'lines' && display.trim()) {
    const letters = textMotion !== 'words',
      n = letters
        ? display.replace(/\s/g, '').length
        : display.trim().split(/\s+/).length,
      step = Math.min(letters ? 0.028 : 0.075, 0.9 / Math.max(1, n));
    settle = Math.max(settle, at + (n - 1) * step + entrance);
  }
  return { motion, entrance, cue, authored, at, settle };
}
