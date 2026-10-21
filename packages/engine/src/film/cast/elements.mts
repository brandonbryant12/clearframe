import type {
  CastSpec,
  CastFrame,
  CastOptions,
  CastStep,
} from './contracts.mjs';
import { createCastStage } from './stage.mjs';
import { finishCast } from './finish.mjs';
import { required } from './common.mjs';
import { travel } from './move-travel.mjs';
import { merge } from './move-merge.mjs';
import { fill } from './move-fill.mjs';
import { camera } from './move-camera.mjs';
import { wave } from './move-wave.mjs';
import { mark } from './move-mark.mjs';
import { move } from './move-general.mjs';
export function castElements(
  spec: CastSpec,
  frame: CastFrame,
  options: CastOptions = {},
) {
  const stage = createCastStage(spec, frame, options);
  spec.formations.forEach((f, k) => {
    const step: CastStep = {
      f,
      k,
      t: stage.times[k],
      stagger: f.stagger ?? 0.06,
      dur: f.dur ?? 1.1,
      ids:
        f.form === 'swap'
          ? [required(f.out, 'out'), required(f.in, 'in')]
          : (f.ids ??
            [...spec.objects.keys()].filter(
              (id) =>
                stage.alive(id) && (f.form !== 'exit' || stage.pose.has(id)),
            )),
    };
    switch (f.form) {
      case 'travel':
        travel(stage, step);
        break;
      case 'merge':
      case 'split':
        merge(stage, step);
        break;
      case 'fill':
      case 'emerge':
        fill(stage, step);
        break;
      case 'camera':
        camera(stage, step);
        break;
      case 'wave':
        wave(stage, step);
        break;
      case 'mark':
        mark(stage, step);
        break;
      default:
        move(stage, step);
    }
  });
  return finishCast(stage, options.threads ?? []);
}
