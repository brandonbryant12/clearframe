import { isRecord } from '../../engine/lib/errors.mjs';

import { finite, numeric, records } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { cardSize } from '../stage-kit.mjs';

import type { FrameSize, StageArea } from '../types.mjs';

/** Where a stage's actors and code may sit: title-safe, below the heading, above the source line. */
export function stageArea(
  frame: FrameSize,
  { heading = true }: { heading?: boolean } = {},
): StageArea {
  const tall = frame.height > frame.width,
    W = frame.width,
    H = frame.height;
  const [belowHeading, top] = tall ? [430, 200] : [300, 120];
  return {
    left: W * (tall ? 0.1 : 0.06),
    right: W * (tall ? 0.9 : 0.94),
    top: heading ? belowHeading : top,
    bottom: H * (tall ? 0.88 : 0.86),
  };
}

/**
 * A stage drawn for a wide frame shown in a tall one would run off the side. Its actors are laid
 * down the frame instead: left-to-right order becomes top-to-bottom (move targets and camera keys
 * follow the same mapping), inside the stage area, below any code editor. Returns the spec to
 * compile and a note when it changed; a stage that already fits is left exactly as authored.
 */
export function fitStage(
  spec: Fields,
  frame: FrameSize,
  area: StageArea,
): { spec: Fields; note: string | null } {
  const actors = records(spec.actors);
  if (frame.height <= frame.width || !actors.length)
    return { spec, note: null };
  // Measured before validation: a missing coordinate is NaN here and refused when compiled.
  const xOf = (p: Fields) => numeric(p.x) ?? NaN,
    yOf = (p: Fields) => numeric(p.y) ?? NaN;
  const boxes = actors.map((a) => ({
    a,
    ...cardSize(String(a.label ?? a.id), a.detail, numeric(a.w), numeric(a.h)),
  }));
  const events = records(spec.events);
  const moveXs = events.filter((e) => e.do === 'move' && finite(e.x)).map(xOf);
  const moveYs = events.filter((e) => e.do === 'move' && finite(e.y)).map(yOf);
  const right = Math.max(...boxes.map((b) => xOf(b.a) + b.w / 2), ...moveXs);
  const left = Math.min(...boxes.map((b) => xOf(b.a) - b.w / 2), ...moveXs);
  if (right <= frame.width && left >= 0) return { spec, note: null };
  const xs = [...boxes.map((b) => xOf(b.a)), ...moveXs],
    ys = [...boxes.map((b) => yOf(b.a)), ...moveYs];
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const maxW = Math.max(...boxes.map((b) => b.w)),
    maxH = Math.max(...boxes.map((b) => b.h));
  // With an editor on the same stage, the actors take the lower part of the area.
  const top = spec.code ? area.top + (area.bottom - area.top) * 0.55 : area.top,
    bottom = area.bottom;
  // A centred column: the authored spacing (capped at 420 px), never more than the area holds.
  const pad = maxH / 2 + 50,
    k = Math.min(1, (area.right - area.left - maxW) / Math.max(1, y1 - y0));
  const span = Math.min(
      bottom - top - 2 * pad,
      x1 - x0,
      420 * Math.max(1, actors.length - 1),
    ),
    mid = (top + bottom) / 2;
  // The axes swap: authored x (left to right) becomes y (top to bottom), authored y becomes x.
  const newX = (y: number) =>
    Math.round(frame.width / 2 + (y - (y0 + y1) / 2) * k);
  const newY = (x: number) =>
    Math.round(x1 > x0 ? mid - span / 2 + ((x - x0) / (x1 - x0)) * span : mid);
  // A point names only the axes it was authored with; an axis it left out stays where it is.
  const remap = (p: Fields) => {
    const ox = finite(p.x) ? p.x : null,
      oy = finite(p.y) ? p.y : null;
    delete p.x;
    delete p.y;
    if (ox != null) p.y = newY(ox);
    if (oy != null) p.x = newX(oy);
  };
  const out = structuredClone(spec);
  for (const a of records(out.actors)) remap(a);
  for (const e of records(out.events))
    if (e.do === 'move' || (e.do === 'camera' && !e.follow)) remap(e);
  const camera = isRecord(out.camera) ? out.camera : null;
  for (const key of records(camera?.keys)) remap(key);
  if (camera && (finite(camera.x) || finite(camera.y))) remap(camera);
  return {
    spec: out,
    note: `drawn for a wide frame; its ${actors.length} actors were laid down the tall frame in the same order. Give the stage tall positions for exact placement.`,
  };
}
