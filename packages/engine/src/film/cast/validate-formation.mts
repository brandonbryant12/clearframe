import type { CastFormation, CastObject } from './contracts.mjs';
import {
  check,
  own,
  FORMS,
  COLORS,
  MARKS,
  fillTone,
  required,
} from './common.mjs';
type Objects = Map<string, CastObject>;
const names = [
  'form',
  'say',
  'at',
  'ids',
  'hero',
  'word',
  'center',
  'spread',
  'scale',
  'dur',
  'stagger',
  'ease',
  'thread',
  'beside',
  'on',
  'out',
  'in',
  'by',
  'mark',
  'to',
  'color',
  'zoom',
  'into',
  'from',
  'via',
  'trail',
];
function unknown(
  objects: Objects,
  ...named: (string | string[] | undefined)[]
): string {
  const bad = named.filter(
    (value) =>
      value != null && (typeof value !== 'string' || !objects.has(value)),
  );
  return bad.length
    ? ` (${bad.map((value) => `"${value}"`).join(', ')} is not an object; the objects are ${[...objects.keys()].join(', ')})`
    : '';
}
function common(f: CastFormation, i: number, objects: Objects): void {
  check(FORMS.includes(f.form), `formations[${i}].form is ${FORMS.join(', ')}`);
  check(
    f.color == null || COLORS.includes(f.color),
    `formations[${i}].color is ${COLORS.join(', ')}`,
  );
  check(
    f.say == null || f.say.trim(),
    `formations[${i}].say is a word of the narration`,
  );
  check(f.at == null || f.at >= 0, `formations[${i}].at is seconds`);
  check(
    f.word == null || f.word.length <= 24,
    `formations[${i}].word is up to 24 characters`,
  );
  for (const id of f.ids ?? [])
    check(objects.has(id), `formations[${i}].ids names unknown object ${id}`);
  for (const key of ['spread', 'scale', 'dur', 'stagger'] as const)
    check(
      f[key] == null || f[key] >= 0,
      `formations[${i}].${key} is a positive number`,
    );
}
function relations(f: CastFormation, i: number, objects: Objects): void {
  check(
    f.beside == null || objects.has(f.beside),
    `formations[${i}].beside names an object`,
  );
  check(
    f.on == null ||
      (objects.has(f.on) &&
        f.beside == null &&
        f.center == null &&
        !(f.ids ?? []).includes(f.on)),
    `formations[${i}].on names another object to centre on (not with beside or center)`,
  );
  check(
    f.by == null ||
      (f.form === 'swap' &&
        f.by.every((id) => objects.has(id) && id !== f.out && id !== f.in)),
    `formations[${i}].by lists the objects that cause a swap (only on swap)`,
  );
}
function travel(f: CastFormation, i: number, objects: Objects): void {
  const target =
    typeof f.to === 'string' &&
    objects.has(f.to) &&
    !(f.ids ?? []).includes(f.to);
  check(
    (f.ids?.length ?? 0) >= 1 && target !== (f.center != null),
    `formations[${i}] (travel) moves ids to another object (to) or a point (center), e.g. {"form": "travel", "ids": ["coin"], "to": "jar", "say": "…"}${unknown(objects, f.to)}`,
  );
  check(
    f.via == null || f.via.length <= 6,
    `formations[${i}].via is up to 6 [x, y] waypoints in frame pixels`,
  );
}
function mark(f: CastFormation, i: number, objects: Objects): void {
  check(
    MARKS.includes(f.mark ?? '') && (f.ids?.length ?? 0) >= 1,
    `formations[${i}] (mark) is a ${MARKS.join(', ')} on ids`,
  );
  const to = typeof f.to === 'string' ? [f.to] : (f.to ?? []);
  check(
    (f.mark === 'arrow') === (f.to != null) &&
      to.every((id) => objects.has(id)),
    `formations[${i}]: an arrow mark points to another object or a list of them (to), and only an arrow does`,
  );
}
function mergeSplit(f: CastFormation, i: number, objects: Objects): void {
  const into =
    f.into != null &&
    objects.has(f.into) &&
    (f.ids?.length ?? 0) >= 1 &&
    !(f.ids ?? []).includes(f.into);
  check(
    f.form === 'merge' ? into : f.into == null,
    `formations[${i}]: merge folds ids into one other object (into), and only merge takes into, e.g. {"form": "merge", "ids": ["pay"], "into": "jar", "say": "…"}${unknown(objects, f.into)}`,
  );
  const from =
    f.from != null &&
    objects.has(f.from) &&
    (f.ids?.length ?? 0) >= 1 &&
    !(f.ids ?? []).includes(f.from);
  check(
    f.form === 'split' ? from : f.from == null,
    `formations[${i}]: split brings ids out of one other object (from), and only split takes from, e.g. {"form": "split", "ids": ["a", "b"], "from": "hub", "say": "…"}${unknown(objects, f.from)}`,
  );
}
function fill(
  f: CastFormation,
  i: number,
  total: number,
  objects: Objects,
): void {
  check(
    f.ids?.length === 1,
    `formations[${i}] (${f.form}) names one object in ids`,
  );
  const id = required(f.ids, 'ids')[0];
  check(
    fillTone(objects.get(id)?.color) != null,
    `formations[${i}] (${f.form}): ${id} must be accent, accent2, surface or ink, the colours a scene can take as its tone`,
  );
  check(
    f.form === 'fill' ? i === total - 1 : i === 0,
    `formations[${i}]: ${f.form === 'fill' ? 'fill is the last move of its beat (the next scene starts in its colour)' : 'emerge is the first move of its beat (it comes out of the scene before)'}`,
  );
}
function moves(
  f: CastFormation,
  i: number,
  total: number,
  objects: Objects,
): void {
  if (f.form === 'swap')
    check(
      f.out != null &&
        objects.has(f.out) &&
        f.in != null &&
        objects.has(f.in) &&
        f.out !== f.in,
      `formations[${i}] (swap) names out and in, two objects: one becomes the other where it stands, e.g. {"form": "swap", "out": "envelope", "in": "shield", "say": "…"}${unknown(objects, f.out, f.in)}`,
    );
  if (f.form === 'hero')
    check(
      f.hero != null && objects.has(f.hero),
      `formations[${i}] (hero) names its hero object`,
    );
  check(
    f.form === 'camera'
      ? f.zoom != null && f.zoom >= 0.6 && f.zoom <= 2.5
      : f.zoom == null,
    `formations[${i}]: zoom (0.6–2.5) belongs to form camera, which needs it`,
  );
  mergeSplit(f, i, objects);
  if (f.form === 'fill' || f.form === 'emerge') fill(f, i, total, objects);
}
export function validateFormation(
  f: CastFormation,
  i: number,
  total: number,
  objects: Objects,
): void {
  own(f, names, `formations[${i}]`);
  common(f, i, objects);
  relations(f, i, objects);
  if (f.form === 'mark') mark(f, i, objects);
  else if (f.form === 'travel') travel(f, i, objects);
  else
    check(
      f.mark == null && f.to == null,
      `formations[${i}]: mark and to belong to form mark (or travel)`,
    );
  check(
    (f.via == null && f.trail == null) || f.form === 'travel',
    `formations[${i}]: via and trail belong to form travel`,
  );
  moves(f, i, total, objects);
}
