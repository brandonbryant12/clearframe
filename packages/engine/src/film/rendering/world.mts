// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { prepareProject } from '../prepare.mjs';

import { writeJSON } from '../../engine/lib/util.mjs';

import { singleFrame } from './stills.mjs';
import type { WorldOptions } from './contracts.mjs';
import type { JobBeat, CanvasElement } from '../types.mjs';

/**
 * One image of a canvas world at its final state, with every beat's camera rect outlined
 * and numbered: the plan view for placing stations and choosing camera moves.
 */
export async function worldMap(
  root: string,
  { draft = true, rough = false, name, out }: WorldOptions = {},
) {
  const ctx = await prepareProject(root, { draft, rough });
  const beats = ctx.job.beats.filter(
    (b) =>
      b.block === 'canvas' &&
      b.props.world &&
      (!name || b.props.world === name),
  );
  if (!beats.length)
    throw new Error(
      name
        ? `No canvas beats in world "${name}"`
        : 'No canvas beats use props.world',
    );
  const world = beats[0].props.world,
    stops = beats.filter((b) => b.props.world === world),
    last = stops[stops.length - 1];
  // Frame the union of the camera rects, padded, at the film's aspect ratio.
  const views = stops.map((b) => worldView(b));
  let l = Math.min(...views.map((v) => v[0])),
    t = Math.min(...views.map((v) => v[1])),
    r = Math.max(...views.map((v) => v[0] + v[2])),
    bt = Math.max(...views.map((v) => v[1] + v[3]));
  const aspect = ctx.job.width / ctx.job.height;
  let w = (r - l) * 1.06,
    h = (bt - t) * 1.06;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const [cx, cy] = [(l + r) / 2, (t + bt) / 2];
  const k = w / ctx.job.width;
  const placed: [number, number][] = [];
  const overlay: CanvasElement[] = stops.flatMap((b, i): CanvasElement[] => {
    const [x, y, vw, vh] = worldView(b),
      color = i % 2 ? '#8ecae6' : '#ff5da2';
    // Rects that share a corner (a return to an earlier view) stack their labels.
    let ly = y + 34 * k;
    while (
      placed.some(
        ([px, py]) => Math.abs(px - x) < 200 * k && Math.abs(py - ly) < 32 * k,
      )
    )
      ly += 34 * k;
    placed.push([x, ly]);
    return [
      {
        type: 'rect',
        x,
        y,
        w: vw,
        h: vh,
        fill: 'none',
        stroke: color,
        width: 3 * k,
        dash: [14 * k, 10 * k],
        enter: 'none',
        at: 0,
      },
      {
        type: 'text',
        text: `${i + 1} ${b.id}`,
        x: x + 12 * k,
        y: ly,
        size: 28 * k,
        font: 'mono',
        fill: color,
        enter: 'none',
        at: 0,
      },
    ];
  });
  const {
    viewFrom: _viewFrom,
    viewNext: _viewNext,
    viewAt: _viewAt,
    viewDur: _viewDur,
    viewDrift: _viewDrift,
    source: _source,
    title: _title,
    kicker: _kicker,
    ...props
  } = last.props;
  const beat: JobBeat = {
    ...last,
    start_frame: 0,
    transition: 'cut',
    exit: 'none',
    camera: { move: 'none' },
    props: {
      ...props,
      view: [cx - w / 2, cy - h / 2, w, h],
      elements: [...(props.elements ?? []), ...overlay],
    },
  };
  delete beat.tone;
  const dir = path.join(ctx.dir, `world-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  const file = path.resolve(
    out ?? path.join(root, 'build', `world-${world}.png`),
  );
  try {
    writeJSON(path.join(dir, 'job.json'), {
      ...ctx.job,
      frames: last.frames,
      frame: undefined,
      beats: [beat],
    });
    await singleFrame({ ...ctx, dir }, (last.frames - 1) / ctx.job.fps, file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return file;
}

function worldView(beat: JobBeat): [number, number, number, number] {
  const v = beat.props.view;
  if (
    !Array.isArray(v) ||
    v.length !== 4 ||
    !v.every((n) => typeof n === 'number' && Number.isFinite(n))
  )
    throw new Error(
      `${beat.id}: canvas world view must be a numeric rectangle`,
    );
  return [v[0], v[1], v[2], v[3]];
}
