import type { CanvasElement, ElementKey } from '../types.mjs';
import type { CastGroup, CastStage, CastStep } from './contracts.mjs';
import { required, check, objectAt, fillTone } from './common.mjs';

export function fill(stage: CastStage, step: CastStep): void {
  const { spec, frame, pose, notes, edges, group } = stage;
  const { f, t, dur, ids } = step;

  const id = ids[0],
    p = pose.get(id);
  if (!p || (f.form === 'emerge' && !p.filled)) {
    notes.push(
      `${f.form} on ${id}: it ${p ? 'has not filled the frame' : 'is not on screen'}, so nothing moves`,
    );
    return;
  }
  const { el, base } = group(id),
    o = objectAt(spec.objects, id),
    solid = solidOf(el);
  const faces = el.children.filter(
    (c) =>
      c.type === 'icon' ||
      c.type === 'text' ||
      /-(detail|part)\d+$/.test(c.id ?? ''),
  );
  // The drawn body under the flat colour is hidden while the object is the frame (its rough
  // outline and hatching would show past the flat shape's edge as it shrinks back). It only
  // ever changes while the opaque flat colour covers it, so the object never turns see-through.
  const tile = required(
    el.children.find((c) => c.id?.endsWith('-tile')),
    'object tile',
  );
  if (f.form === 'fill') {
    // Large enough that the flat colour (a rounded rectangle) covers the whole frame through the
    // camera: its inscribed rectangle (half-extent less 0.293 r at each corner) must reach the
    // frame edges, after the camera's zoom and pan move the middle of the stage.
    const a = solid.w / 2 - 0.293 * solid.r,
      b = solid.h / 2 - 0.293 * solid.r,
      z = stage.cam.zoom;
    const cover =
      Math.max(
        (frame.width / 2 + Math.abs(stage.cam.x)) / (z * a),
        (frame.height / 2 + Math.abs(stage.cam.y)) / (z * b),
      ) * 1.06;
    // The flat colour is the body, which need not sit on the object's origin (a person's
    // shoulders hang below it): place the group so the body's centre, scaled, lands mid-frame.
    const fx = frame.width / 2 - cover * (solid.x + solid.w / 2),
      fy = frame.height / 2 - cover * (solid.y + solid.h / 2);
    el.keys.push({
      at: t,
      x: fx - base.x,
      y: fy - base.y,
      scale: cover,
      rotate: 0,
      opacity: 1,
      dur,
      ease: f.ease ?? 'in',
    });
    solid.keys.push({ at: t, opacity: 1, dur: dur * 0.6 });
    for (const c of faces)
      c.keys = [
        ...(c.keys ?? [{ at: 0, opacity: 1, dur: 0 }]),
        { at: t, opacity: 0, dur: dur * 0.4 },
      ];
    tile.keys = [
      ...(tile.keys ?? [{ at: 0, opacity: 1, dur: 0 }]),
      { at: t + dur * 0.6, opacity: 0, dur: dur * 0.15 },
    ];
    pose.set(id, {
      x: fx,
      y: fy,
      scale: cover,
      rotate: 0,
      opacity: 1,
      z: ++stage.top,
      filled: { ...p, filled: undefined },
    });
    edges.fill = fillTone(o.color);
  } else {
    const back = required(p.filled, 'filled pose');
    el.keys.push({
      at: t,
      x: back.x - base.x,
      y: back.y - base.y,
      scale: back.scale ?? 1,
      rotate: back.rotate ?? 0,
      opacity: back.opacity ?? 1,
      dur,
      ease: f.ease ?? 'out',
    });
    tile.keys = [
      ...(tile.keys ?? [{ at: 0, opacity: 0, dur: 0 }]),
      { at: t + dur * 0.35, opacity: 1, dur: 0 },
    ];
    solid.keys.push({ at: t + dur * 0.35, opacity: 0, dur: dur * 0.5 });
    for (const c of faces)
      c.keys = [
        ...(c.keys ?? [{ at: 0, opacity: 0, dur: 0 }]),
        { at: t + dur * 0.45, opacity: 1, dur: dur * 0.4 },
      ];
    pose.set(id, { ...back, z: p.z });
    edges.emerge = fillTone(o.color);
  }
  return;
}

interface Solid extends CanvasElement {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  keys: ElementKey[];
}
function isSolid(el: CanvasElement): el is Solid {
  return (
    typeof el.x === 'number' &&
    typeof el.y === 'number' &&
    typeof el.w === 'number' &&
    typeof el.h === 'number' &&
    typeof el.r === 'number' &&
    Array.isArray(el.keys)
  );
}
function solidOf(group: CastGroup): Solid {
  const solid = required(
    group.children.find((el) => el.id?.endsWith('-solid')),
    'object solid',
  );
  check(isSolid(solid), 'object solid has invalid geometry');
  return solid;
}
