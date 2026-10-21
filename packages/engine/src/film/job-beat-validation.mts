import type { BeatLayers } from './types.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function validateBeatTiming(
  { b, props, spec, cue, report, sb, settle, frame }: BeatState,
  layers: BeatLayers,
): void {
  if (layers.camera?.to) {
    const c = layers.camera;
    c.at = c.say != null ? cue(c.say) : (c.at ?? 0.6);
    delete c.say;
    c.dur ??= 1.4;
  }
  if (spec.numeric) {
    if (!props.source || !sb.sources.length)
      throw new Error(
        'Numbers need visible props.source and a storyboard.sources entry.',
      );
    if (settle > b.dur - frame + 1e-6)
      (report.draft ? report.warnings : report.errors).push(
        `${b.id}: values finish counting at ${settle.toFixed(2)}s but the beat ends at ${b.dur.toFixed(2)}s, so the final figures would never be shown; extend the beat or cue earlier.`,
      );
  }
}
