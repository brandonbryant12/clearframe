import { errorMessage } from './errors.mjs';
import { comparePixels, rgb } from './library-bar-media.mjs';
import type {
  BarSensitivity,
  BarSensitivityResult,
  PreparedCase,
} from './library-bar-contracts.mjs';
export function runSensitivity(
  spec: BarSensitivity,
  prepared: Map<string, PreparedCase>,
): BarSensitivityResult {
  const a = prepared.get(spec.base),
    b = prepared.get(spec.changed);
  const result: BarSensitivityResult = { ...spec, status: 'failed' };
  try {
    if (!a || !b) throw new Error('Sensitivity needs two rendered cases');
    if (
      a.job.width !== b.job.width ||
      a.job.height !== b.job.height ||
      a.job.fps !== b.job.fps
    )
      throw new Error('Sensitivity cases must share dimensions and frame rate');
    const frame = Math.min(a.job.frames - 1, Math.round(spec.at * a.job.fps));
    const before = a.frames.get(frame),
      after = b.frames.get(frame);
    if (!before || !after)
      throw new Error('Sensitivity frame is unavailable in one case');
    const metrics = comparePixels(rgb(before), rgb(after));
    result.changedFraction = metrics.changedFraction;
    result.changedPixels = metrics.changedPixels;
    result.status =
      metrics.changedFraction >= (spec.minChangedFraction ?? 0.001)
        ? 'passed'
        : 'failed';
    if (result.status === 'failed')
      result.error =
        'The declared prop change did not change enough pixels; inspect whether it is actually drawn.';
  } catch (e) {
    result.error = errorMessage(e);
  }
  return result;
}
