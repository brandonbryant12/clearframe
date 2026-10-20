import type { CanvasElement, Point } from '../types.mjs';
import type { CastObject, CastPose, CastGroup } from './contracts.mjs';
import { objectDefinition } from './objects.mjs';
import { castLook, pixelCell } from './looks.mjs';
import { required, hash } from './common.mjs';
export function labelBelow(o: Partial<CastObject>, size: number) {
  const s = o.size ?? size;
  return o.label ? s * 0.84 + Math.max(22, s * 0.2) * 0.3 : 0;
}

export function objectExtent(o: Partial<CastObject>, size: number): Point {
  const s = o.size ?? size;
  if (o.shape)
    return [
      objectDefinition(o.shape).extent[0] * s,
      objectDefinition(o.shape).extent[1] * s,
    ];
  return o.word
    ? [Math.max(s * 0.6, o.word.length * s * 0.3 * 0.29 + s * 0.25), s * 0.3]
    : [s / 2, s / 2];
}

/**
 * The object as drawn: a group centred on its position (a tile with an icon, or a word on a pill).
 * One that has filled the frame is drawn as its flat colour, its face hidden, until it emerges.
 */
export function objectElement(
  o: CastObject,
  id: string,
  size: number,
  base: CastPose,
  enter: Pick<CanvasElement, 'at' | 'enter' | 'dur' | 'dist'>,
  look = 'tiles',
): CastGroup {
  const s = o.size ?? size,
    children: CanvasElement[] = [],
    L = castLook(look);
  // Hidden and shown by keys from frame one (a base opacity would multiply every later key).
  const face = (el: CanvasElement): CanvasElement =>
    base.filled ? { ...el, keys: [{ at: 0, opacity: 0, dur: 0 }] } : el;
  // An object that is the frame shows only its flat colour: its drawn body and parts are hidden
  // too (their outline and hatching would show past the colour's edge as it emerges).
  const under = (el: CanvasElement): CanvasElement =>
    base.filled ? { ...el, keys: [{ at: 0, opacity: 0, dur: 0 }] } : el;
  if (o.word) {
    const [hw, hh] = objectExtent(o, size),
      fs = s * (look === 'drawn' ? 0.36 : 0.3);
    children.push(
      under({
        type: 'rect',
        id: `${id}-tile`,
        x: -hw,
        y: -hh,
        w: hw * 2,
        h: hh * 2,
        r: hh,
        fill: o.color,
        enter: 'none',
        ...L.tile(s),
      }),
      face({
        type: 'text',
        id: `${id}-word`,
        text: o.word,
        x: 0,
        y: fs * 0.36,
        size: fs,
        font: L.font,
        fill: look === 'drawn' || o.color !== 'ink' ? 'ink' : 'bg',
        anchor: 'middle',
        fit: hw * 2 - s * 0.3,
        enter: 'none',
      }),
    );
  } else if (o.shape) {
    // The body takes the look; parts of the body (a bubble's tail, a person's head) do too, and the
    // details are drawn in the colour that reads on it (by hand in the drawn look).
    const { body, details } = objectDefinition(o.shape).draw(
      s,
      L.mark(o),
      o.color,
    );
    children.push(
      under({
        type: 'rect',
        id: `${id}-tile`,
        ...body,
        fill: o.color,
        enter: 'none',
        ...L.tile(s),
      }),
    );
    details.forEach(({ body: part, ...el }, k) =>
      children.push(
        part
          ? under({ ...el, id: `${id}-part${k}`, enter: 'none', ...L.tile(s) })
          : face({
              ...el,
              id: `${id}-detail${k}`,
              enter: 'none',
              ...(look === 'drawn' && el.type !== 'circle'
                ? { rough: { amount: 0.8, passes: 1 } }
                : {}),
              ...(look === 'pixel' && el.type !== 'text' && el.fill !== 'none'
                ? { mosaic: { style: 'pixel', tile: pixelCell(s) } }
                : {}),
            }),
      ),
    );
  } else {
    children.push(
      under({
        type: 'rect',
        id: `${id}-tile`,
        x: -s / 2,
        y: -s / 2,
        w: s,
        h: s,
        r: s * 0.26,
        fill: o.color,
        enter: 'none',
        ...L.tile(s),
      }),
      face({
        type: 'icon',
        id: `${id}-icon`,
        name: o.icon,
        x: 0,
        y: 0,
        size: s * 0.52,
        stroke: L.mark(o),
        enter: 'none',
      }),
    );
  }
  // The flat colour an object floods the frame with (fill/emerge) is its body exactly, so the
  // flood shrinks back as the object's own shape and the drawn body, its parts and its face
  // fade in over it where it lands (fill/emerge hide them while it is the frame).
  const { x, y, w, h, r } = required(children[0], 'object body');
  children.splice(1, 0, {
    type: 'rect',
    id: `${id}-solid`,
    x,
    y,
    w,
    h,
    r,
    fill: o.color,
    enter: 'none',
    keys: [{ at: 0, opacity: base.filled ? 1 : 0, dur: 0 }],
  });
  if (o.label)
    children.push({
      type: 'text',
      id: `${id}-label`,
      text: o.label,
      x: 0,
      y: s * 0.5 + s * 0.34,
      size: Math.max(22, s * (look === 'drawn' ? 0.24 : 0.2)),
      font: L.label,
      fill: look === 'drawn' ? 'ink' : 'muted',
      anchor: 'middle',
      enter: 'none',
    });
  // The starting pose is a key at 0, so every later key is absolute (opacity and rotation never compound).
  return {
    type: 'group',
    id,
    x: base.x,
    y: base.y,
    shadow: L.shadow,
    children,
    ...enter,
    keys: [
      {
        at: 0,
        scale: base.scale ?? 1,
        rotate: base.rotate ?? 0,
        opacity: base.opacity ?? 1,
        dur: 0,
      },
    ],
    ...(o.float
      ? { loop: { type: 'float', period: 3.4 + hash(id) * 1.6, amount: 0.35 } }
      : {}),
  };
}
