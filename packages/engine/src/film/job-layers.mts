import type {
  ResolvedStoryboard as Storyboard,
  TimedBeat as TimingBeat,
  Beat as StoryboardBeat,
} from '../engine/domain.mjs';
import type { JobReport, BeatLayers } from './types.mjs';

import { lensSpec } from './job-lens.mjs';
import { steadyFilm } from './job-steady.mjs';

import { layerFields } from './job-layer-fields.mjs';
import { layerCamera } from './job-layer-camera.mjs';
import { plateSpec, footageDrift } from './job-layer-plate.mjs';
export { plateSpec, footageDrift } from './job-layer-plate.mjs';
export function beatLayers(
  source: StoryboardBeat,
  b: TimingBeat,
  sb: Storyboard,
  report: JobReport,
): BeatLayers {
  const out: BeatLayers = {};
  // The lens is resolved per beat: film settings, then the beat's own.
  const lens = { ...(sb.lens ?? {}), ...(lensSpec(source.lens) ?? {}) };
  const steady = steadyFilm(sb);
  if (source.plate && (source.plate.side ?? 'full') === 'full')
    report.warnings.push(
      `${source.id}: inspect native text over background media at opening, middle, end and lighting changes, including 360 px. Blur/scrim alone does not prove legibility; use a split or opaque panel if needed.`,
    );
  if (Object.keys(lens).length) out.lens = lens;
  layerFields(source, b, sb, out);
  layerCamera(source, b, sb, out);
  if (source.plate != null) out.plate = plateSpec(source.plate, b.block);
  // A steady film's plates hold still too; a drift is something a beat asks for.
  if (out.plate && steady) out.plate.drift ??= 'none';
  footageDrift(source, sb, out, report);
  return out;
}
