import { pathBox } from './path.mjs';

import type { CanvasElement, Fail } from '../types.mjs';
import { unprovable, MOVES } from './movement.mjs';
import type { Move } from './movement.mjs';

/** The exact box of an element [left, top, right, bottom], in its group's coordinates. */
export function box(el: CanvasElement, where: string, fail: Fail): number[] {
  const r = (x: number, y: number, w: number, h: number): number[] => [
    x,
    y,
    x + w,
    y + h,
  ];
  // Required geometry (w and h, r, x2 and y2…) is present on a validated element.
  switch (el.type) {
    case 'rect':
    case 'image':
    case 'document':
    case 'meter':
    case 'particles':
      return r(el.x ?? 0, el.y ?? 0, el.w ?? 0, el.h ?? 0);
    case 'spotlight':
      return el.w != null
        ? r(el.x ?? 0, el.y ?? 0, el.w, el.h ?? 0)
        : [
            (el.cx ?? 0) - (el.r ?? 0),
            (el.cy ?? 0) - (el.r ?? 0),
            (el.cx ?? 0) + (el.r ?? 0),
            (el.cy ?? 0) + (el.r ?? 0),
          ];
    case 'circle': {
      const radius = el.r ?? 0;
      return [
        (el.cx ?? 0) - radius,
        (el.cy ?? 0) - radius,
        (el.cx ?? 0) + radius,
        (el.cy ?? 0) + radius,
      ];
    }
    case 'ellipse': {
      const rx = el.rx ?? 0,
        ry = el.ry ?? 0;
      return [
        (el.cx ?? 0) - rx,
        (el.cy ?? 0) - ry,
        (el.cx ?? 0) + rx,
        (el.cy ?? 0) + ry,
      ];
    }
    case 'line': {
      const half = (el.width ?? 2) / 2,
        x2 = el.x2 ?? 0,
        y2 = el.y2 ?? 0;
      return [
        Math.min(el.x1 ?? 0, x2) - half,
        Math.min(el.y1 ?? 0, y2) - half,
        Math.max(el.x1 ?? 0, x2) + half,
        Math.max(el.y1 ?? 0, y2) + half,
      ];
    }
    case 'path':
      return pathBox(el, where, fail);
    case 'poly': {
      const xs = (el.points ?? []).map((p) => p[0]),
        ys = (el.points ?? []).map((p) => p[1]);
      return [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
    }
    case 'group': {
      // A group's box is the union of its shapes. Its text and icons are taken to sit inside those
      // shapes (a card's words); any other child whose drawn box cannot be proved is refused by name,
      // never quietly left out of the union.
      const boxes = (el.children ?? [])
        .map((c, i) =>
          childBox(
            c,
            `${where}: the group ${el.id ?? ''}'s child ${c.id ?? `${c.type} ${i + 1}`}`,
            fail,
          ),
        )
        .filter((b): b is number[] => b != null);
      if (!boxes.length)
        fail(
          `${where}: the group ${el.id ?? ''} has no shapes with a known box (only text or icons); frame a rect or card inside it`,
        );
      const [gx, gy] = [el.x ?? 0, el.y ?? 0];
      return [
        Math.min(...boxes.map((b) => b[0])) + gx,
        Math.min(...boxes.map((b) => b[1])) + gy,
        Math.max(...boxes.map((b) => b[2])) + gx,
        Math.max(...boxes.map((b) => b[3])) + gy,
      ];
    }
    case 'text':
      return fail(
        `${where}: ${el.id} is text, which has no measured box before rendering; frame the card, row or group it sits in`,
      );
    default:
      return fail(
        `${where}: ${el.id} is a ${el.type}, which has no exact box to frame; frame a rect, card or group`,
      );
  }
}

// Words and marks inside a card: text, icons and groups made only of them. They are the card's
// content, inside its shapes, and are not part of its box (stated, not approximated).
export const content = (c: CanvasElement): boolean =>
  ['text', 'icon', 'pointer'].includes(c.type) ||
  (c.type === 'group' && (c.children ?? []).every(content));

export function childBox(
  c: CanvasElement,
  where: string,
  fail: Fail,
): number[] | null {
  if (content(c)) return null;
  const why =
    unprovable(c) ??
    ((c.keys ?? []).some((k) => MOVES.some((m) => k[m] != null)) || c.along
      ? 'moves (keys or a route)'
      : null) ??
    (['solid', 'particles'].includes(c.type)
      ? `is a ${c.type}, whose exact box is not known here`
      : null);
  if (why)
    fail(
      `${where} ${why}, so the group's drawn box cannot be proved; frame a still shape inside it, or the group's own card`,
    );
  return box(c, where, fail);
}

/** Where keys that only move and scale leave an element's box (for `state: "end"`). */
export function moved(
  b: number[],
  el: CanvasElement,
  where: string,
  fail: Fail,
): number[] {
  const end: Partial<Record<Move, number>> = {};
  for (const k of el.keys ?? [])
    for (const m of MOVES) {
      const v = k[m];
      if (v != null) end[m] = v;
    }
  if (end.rotate) fail(`${where}: ${el.id} turns; frame a still element`);
  // As the native pose: a key's scale multiplies its scaleX and scaleY (each holds until changed).
  const sx = (end.scale ?? 1) * (end.scaleX ?? 1),
    sy = (end.scale ?? 1) * (end.scaleY ?? 1);
  if (sx === 0 || sy === 0)
    fail(`${where}: ${el.id} ends scaled to nothing; there is no box to frame`);
  const [ox, oy] = el.origin ?? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const dx = end.x ?? 0,
    dy = end.y ?? 0;
  const xs = [ox + (b[0] - ox) * sx + dx, ox + (b[2] - ox) * sx + dx],
    ys = [oy + (b[1] - oy) * sy + dy, oy + (b[3] - oy) * sy + dy];
  // A negative scale mirrors the box; its bounds are still the outer edges.
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
