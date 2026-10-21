import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { JobBeat } from './types.mjs';
import type { BeatContext } from './job-types.mjs';
import type { BeatState } from './job-beat-contracts.mjs';
import { beatBasics } from './job-beat-basics.mjs';
import { prepareBeatProps } from './job-beat-props.mjs';
import { beatTiming } from './job-beat-timing.mjs';
import { artScheduler } from './job-beat-art.mjs';
import { prepareCanvasBeat } from './job-beat-canvas.mjs';
import { validateBeatTiming } from './job-beat-validation.mjs';
import { validateBeatVoice } from './job-beat-voice.mjs';
import { warnAmbiguousCues } from './job-beat-ambiguity.mjs';
import { finishBeat } from './job-beat-finish.mjs';
import { artLayers } from './job-art.mjs';
import { keepPace } from './job-pace.mjs';
import { beatLayers } from './job-layers.mjs';
export function prepareBeat(b: TimingBeat, context: BeatContext): JobBeat {
  const basics = beatBasics(b, context);
  const props = prepareBeatProps(b, context, basics);
  const timingState = beatTiming(b, context, basics, props);
  const state: BeatState = { ...context, ...basics, ...timingState, b, props };
  const { source, timing, at, sb, report } = state;
  const scheduleArt = artScheduler(state);
  if (b.block === 'canvas') prepareCanvasBeat(state, scheduleArt);
  const art =
    source.art != null
      ? artLayers(source.art, b.id, {
          width: timing.width,
          height: timing.height,
          duration: b.dur,
        })
      : null;
  if (art)
    state.settle = Math.max(
      state.settle,
      scheduleArt(art.under, at),
      scheduleArt(art.over, at),
    );
  const paced = keepPace(b, source, props, art, at, { sb, report });
  const layers = beatLayers(source, b, sb, report);
  validateBeatTiming(state, layers);
  validateBeatVoice(state);
  warnAmbiguousCues(state);
  return finishBeat(state, art, paced, layers);
}
