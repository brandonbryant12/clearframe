import type { CastStage, CastStep, CastPose } from './contracts.mjs';
import { objectAt } from './common.mjs';
import { objectExtent } from './draw.mjs';
type PlacedObject = [string, CastPose];
function overlaps(
  stage: CastStage,
  [ia, pa]: PlacedObject,
  [ib, pb]: PlacedObject,
): boolean {
  const box = (id: string, pose: CastPose) =>
    objectExtent(objectAt(stage.spec.objects, id), stage.size).map(
      (value) => value * (pose.scale ?? 1),
    );
  const [aw, ah] = box(ia, pa),
    [bw, bh] = box(ib, pb);
  const ox = Math.max(
    0,
    Math.min(pa.x + aw, pb.x + bw) - Math.max(pa.x - aw, pb.x - bw),
  );
  const oy = Math.max(
    0,
    Math.min(pa.y + ah, pb.y + bh) - Math.max(pa.y - ah, pb.y - bh),
  );
  const small = Math.min(aw * ah, bw * bh),
    large = Math.max(aw * ah, bw * bh);
  return small > 0.15 * large && ox * oy > 0.25 * 4 * small;
}
function firstOverlap(
  stage: CastStage,
  shown: PlacedObject[],
): [string, string] | null {
  for (let a = 0; a < shown.length; a++) {
    for (let b = a + 1; b < shown.length; b++) {
      if (overlaps(stage, shown[a], shown[b]))
        return [shown[a][0], shown[b][0]];
    }
  }
  return null;
}
export function warnOverlap(stage: CastStage, { f, k }: CastStep): void {
  const shown = [...stage.pose].filter(
    ([id, p]) =>
      !p.gone &&
      !p.quiet &&
      !p.filled &&
      (p.opacity ?? 1) > 0.5 &&
      stage.spec.objects.has(id),
  );
  const pair = firstOverlap(stage, shown);
  if (!pair) return;
  const [ia, ib] = pair,
    carried = pair.filter((id) => stage.state.has(id));
  const past = carried.length
    ? ` (${carried.join(' and ')} carried from an earlier beat)`
    : '';
  stage.notes.push(
    `overlap: after formation ${k + 1} (${f.form}${f.say ? ` on "${f.say}"` : ''}) ${ia} and ${ib} stand on each other${past}: start this beat's cast with "fresh": true, send carried objects off with {"form": "exit", "ids": [...]}, or place them apart`,
  );
}
