import type {
  ResolvedStoryboard as Storyboard,
  TimedBeat as TimingBeat,
  Beat as StoryboardBeat,
} from '../engine/domain.mjs';
import type { BeatLayers } from './types.mjs';

import { TONES, TRANSITION_COLORS, TEXT_MOTIONS } from './constants.mjs';

import { typeById } from './library.mjs';
import { voiceOf, DEFAULT_VOICE } from './type.mjs';

export function layerFields(
  source: StoryboardBeat,
  b: TimingBeat,
  sb: Storyboard,
  out: BeatLayers,
): void {
  const heading = source.heading ?? sb.heading;
  if (heading != null) {
    if (!['top', 'bottom'].includes(heading))
      throw new Error('heading must be top or bottom');
    out.heading = heading;
  }
  if (source.textMotion != null) {
    if (!TEXT_MOTIONS.includes(source.textMotion))
      throw new Error(`textMotion must be ${TEXT_MOTIONS.join(', ')}`);
    out.text_motion = source.textMotion;
  }
  // A scene's own type voice (a bookish chapter inside a geometric film); `inter` opts back out.
  if (source.type != null)
    out.type = voiceOf(source.type, typeById(source.type)) ?? DEFAULT_VOICE;
  if (source.tone != null) {
    if (!TONES.includes(source.tone))
      throw new Error(`tone must be ${TONES.join(', ')}`);
    out.tone = source.tone;
  }
  layerLabels(source, b, sb, out);
}

function layerLabels(
  source: StoryboardBeat,
  b: TimingBeat,
  sb: Storyboard,
  out: BeatLayers,
): void {
  // The origin placed the retired iris; a panel always crosses the whole frame.
  if (source.transitionOrigin != null)
    throw new Error(
      'transitionOrigin was retired with the iris transition: remove it (a panel crosses the whole frame)',
    );
  if (source.transitionColor != null) {
    if (!TRANSITION_COLORS.includes(source.transitionColor))
      throw new Error(
        `transitionColor must be ${TRANSITION_COLORS.join(', ')}`,
      );
    out.enter_style = { color: source.transitionColor };
  }
  if (
    source.label != null &&
    (typeof source.label !== 'string' || source.label.length > 40)
  )
    throw new Error('label must be text up to 40 characters');
  const label =
    source.label ??
    (sb.frame && typeof b.chapter === 'string' ? b.chapter.slice(0, 40) : '');
  if (label) out.label = label;
  if (source.speaker && sb.speakers?.[source.speaker])
    out.speaker = {
      ...sb.speakers[source.speaker],
      id: source.speaker,
      continues:
        b.index > 0 && sb.beats[b.index - 1].speaker === source.speaker,
    };
}
