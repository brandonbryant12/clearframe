import type { CanvasElement, Fail, TargetSpec } from '../types.mjs';
import { thrown, unprovable, MOVES } from './movement.mjs';
import { find } from './lookup.mjs';
import { box, moved } from './geometry.mjs';

export interface TargetFrame {
  width: number;
  height: number;
  where?: string;
  fail?: Fail;
  maxZoom?: number;
}

/**
 * A camera rect [x, y, w, h] on the named elements: their union box, padded by `pad` of its size,
 * widened to the frame's aspect, never closer than `maxZoom` times. `elements` is everything the
 * beat can see (a world beat includes what earlier beats drew).
 */
export function targetRect(
  spec: TargetSpec,
  elements: CanvasElement[],
  { width, height, where = 'view', fail = thrown, maxZoom = 4 }: TargetFrame,
): number[] {
  const boxes = spec.ids.map((id) => {
    const hit = find(elements, id);
    if (!hit)
      return fail(
        `${where}.on names "${id}", which no element of this beat${spec.world ? ' or its world' : ''} has`,
      );
    const { el } = hit;
    if (hit.inside)
      fail(
        `${where}: ${id} is inside ${hit.inside}, which is scaled, turned or placed in depth; frame the group itself`,
      );
    const why = unprovable(el);
    if (why)
      fail(
        `${where}: ${id} ${why}; its box on screen is not its authored box, so it cannot be framed exactly`,
      );
    const moves =
      el.along != null ||
      (el.keys ?? []).some((k) => MOVES.some((m) => k[m] != null)) ||
      hit.moving;
    if (moves && spec.state == null)
      fail(
        `${where}: ${id} moves (keys or a route); say which state to frame with state: "start" (as authored) or "end" (where its keys leave it)`,
      );
    if (moves && spec.state === 'end' && (el.along != null || hit.moving))
      fail(
        `${where}: ${id} travels a route or moves with its group; only state: "start" can be framed`,
      );
    let b = box(el, `${where}.on`, fail);
    if (moves && spec.state === 'end') b = moved(b, el, `${where}.on`, fail);
    return [b[0] + hit.dx, b[1] + hit.dy, b[2] + hit.dx, b[3] + hit.dy];
  });
  let [x0, y0, x1, y1] = [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
  const pw = (x1 - x0) * spec.pad,
    ph = (y1 - y0) * spec.pad;
  x0 -= pw;
  x1 += pw;
  y0 -= ph;
  y1 += ph;
  // Widen to the frame's aspect around the target's centre; never closer than maxZoom.
  const aspect = width / height,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  let w = Math.max(x1 - x0, width / maxZoom),
    h = Math.max(y1 - y0, height / maxZoom);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [cx - w / 2, cy - h / 2, w, h].map((v) => Math.round(v * 100) / 100);
}
