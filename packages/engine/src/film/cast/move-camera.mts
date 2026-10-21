import { required } from './common.mjs';
import type { CastStage, CastStep } from './contracts.mjs';

export function camera(stage: CastStage, step: CastStep): void {
  const { frame, camKeys, pose } = stage;
  const { f, t } = step;

  const p = f.on != null ? pose.get(f.on) : null,
    z = required(f.zoom, 'camera zoom');
  stage.cam = {
    zoom: z,
    x: p ? -z * (p.x - frame.width / 2) * 0.7 : 0,
    y: p ? -z * (p.y - frame.height / 2) * 0.7 : 0,
  };
  camKeys.push({
    at: t,
    scale: stage.cam.zoom,
    x: stage.cam.x,
    y: stage.cam.y,
    dur: f.dur ?? 1.8,
    ease: f.ease ?? 'inOut',
  });
  return;
}
