import { required } from '../drawing/contracts.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { SAMPLES } from './common.mjs';
import type { holdAxis } from './axis.mjs';

function aboveRange(vals: number[], lock: number, iA: number) {
  let iu: number | null = null;
  for (let i = iA; i <= SAMPLES; i++) {
    if (vals[i] > lock) {
      iu = i;
      break;
    }
  }
  if (iu === null) return null;
  let id = iu;
  while (vals[id + 1] > lock && id + 1 <= SAMPLES) id++;
  return { iu, id };
}

function gapEdge(
  pts: number[][],
  shadeY: number,
  a: number,
  z: number,
  iu: number,
  id: number,
) {
  const crossing = (i: number, j: number) => {
    const [first, next] = [pts[i], pts[j]];
    const k = (shadeY - first[1]) / (next[1] - first[1]);
    return [round(first[0] + (next[0] - first[0]) * k), shadeY];
  };
  const edge: number[][] = [];
  if (a === iu && iu > 0) edge.push(crossing(iu - 1, iu));
  for (let i = a; i <= z; i++) edge.push(pts[i]);
  if (z === id && id < SAMPLES) edge.push(crossing(id, id + 1));
  return [
    ...edge,
    [required(edge.at(-1), 'gap endpoint')[0], shadeY],
    [edge[0][0], shadeY],
  ];
}

export function shadeLockGap(context: ReturnType<typeof holdAxis>) {
  const { lock, vals, iA, lockY, pts, tip, els, cued } = context;
  const range = aboveRange(vals, lock, iA);
  if (!range) return { iu: null, id: null };
  const { iu, id } = range;
  const shadeY = round(lockY - 3);
  for (let a = iu; a < id; a += 5) {
    const z = Math.min(id, a + 6);
    const { cue, dt } = tip(z);
    els.push({
      type: 'poly',
      rough: false,
      points: gapEdge(pts, shadeY, a, z, iu, id),
      closed: true,
      fill: 'wash',
      enter: 'fade',
      dur: 0.3,
      ...cued(cue, round(dt + 0.05)),
    });
  }
  return range;
}
