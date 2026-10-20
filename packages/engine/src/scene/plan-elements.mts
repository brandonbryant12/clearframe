// A layer's elements on their way into the plan: authored ones checked against what native
// stages draw, spoken cues resolved to layer seconds, and the time by which all have arrived.
import { isRecord } from '../engine/lib/errors.mjs';
import { retired } from '../film/constants.mjs';
import { fail, numeric } from './fields.mjs';
import type { LayerCue, PlanElement } from './types.mjs';

const NATIVE_TYPES = [
  'rect',
  'circle',
  'ellipse',
  'line',
  'path',
  'poly',
  'text',
  'icon',
  'image',
  'group',
  'particles',
  'spotlight',
  'video',
  'shader',
  'code',
  'connector',
];
const BLOCK_ONLY = [
  'rough',
  'print',
  'mosaic',
  'morph',
  'solid',
  'meter',
  'marks',
];

export const isPlanElement = (value: unknown): value is PlanElement =>
  isRecord(value) && typeof value.type === 'string';

/** Walk elements (groups included). */
function each(list: unknown, fn: (el: unknown) => void): void {
  const elements: readonly unknown[] = Array.isArray(list) ? list : [];
  for (const el of elements) {
    fn(el);
    if (isRecord(el) && el.type === 'group') each(el.children, fn);
  }
}
/** Walk elements already checked by resolveTimes. */
export const eachElement = (list: unknown, fn: (el: PlanElement) => void) =>
  each(list, (el) => {
    if (isPlanElement(el)) fn(el);
  });

/** Refuse what native stages do not draw: an unknown type, a canvas-only feature, a retired motion. */
function checkElement(el: unknown, where: string): asserts el is PlanElement {
  if (!isRecord(el)) fail(where, 'elements are objects');
  const name = String(el.id ?? el.type ?? 'element');
  if (typeof el.type !== 'string' || !NATIVE_TYPES.includes(el.type))
    fail(
      where,
      `${name} has type ${JSON.stringify(el.type)}; native stages draw ${NATIVE_TYPES.join(', ')}`,
    );
  const level = isRecord(el.loop) && el.loop.type === 'level';
  for (const k of BLOCK_ONLY)
    if (el[k] != null || level)
      fail(
        where,
        `${String(el.id ?? el.type)} uses ${el[k] != null ? k : 'loop level'}, which the canvas block draws; native stages do not. Put it in canvas/art, or remove it.`,
      );
  const gone = retired('enter', el.enter) ?? retired('exit', el.exit);
  if (gone) fail(where, `${String(el.id ?? el.type)}: ${gone}`);
}

const atOf = (v: unknown) => (isRecord(v) ? (numeric(v.at) ?? 0) : 0);
const listOf = (v: unknown): readonly unknown[] => (Array.isArray(v) ? v : []);

/** A spoken cue on a key, a path or a shine becomes its `at`. */
function resolveSay(o: unknown, cue: LayerCue): void {
  if (isRecord(o) && o.say != null) {
    o.at = cue(o.say);
    delete o.say;
  }
}

/** Resolve `say` (and its relatives) to layer seconds, in place. */
function resolveElement(el: unknown, cue: LayerCue, where: string): void {
  checkElement(el, where);
  if (el.say != null) {
    // Text arrives a moment before its word, so it is read as it is spoken.
    el.at = Math.max(0, cue(el.say) - (el.type === 'text' ? 0.2 : 0));
    delete el.say;
  }
  if (el.exitSay != null) {
    el.exitAt = cue(el.exitSay);
    delete el.exitSay;
  }
  // An exit time without an exit kind fades out (as canvas elements do).
  if (el.exitAt != null && el.exit == null) el.exit = 'fade';
  for (const k of listOf(el.keys)) resolveSay(k, cue);
  if (Array.isArray(el.keys))
    el.keys.sort((a: unknown, b: unknown) => atOf(a) - atOf(b));
  for (const o of [el.along, el.shine]) resolveSay(o, cue);
}

/** Check every element and resolve its cues; returns the checked elements. */
export function resolveTimes(
  list: readonly unknown[],
  cue: LayerCue,
  where: string,
): PlanElement[] {
  each(list, (el) => resolveElement(el, cue, where));
  return list.filter(isPlanElement);
}

const durOf = (v: unknown) => (isRecord(v) ? numeric(v.dur) : undefined);

/** Seconds by which one element has arrived: its entrance, keys, travel, code steps and count. */
function arrivedBy(el: PlanElement, entrance: number): number {
  const at = numeric(el.at) ?? 0;
  const along = isRecord(el.along) ? el.along : {};
  const steps = el.type === 'code' ? listOf(el.steps) : [];
  return Math.max(
    at + (numeric(el.dur) ?? entrance),
    ...listOf(el.keys).map((k) => atOf(k) + (durOf(k) ?? 0.6)),
    el.along ? (numeric(along.at) ?? at) + (numeric(along.dur) ?? 1.5) : 0,
    ...steps.map((st) => atOf(st) + (numeric(el.dur) ?? 0.7)),
    el.count ? at + (durOf(el.count) ?? 1.2) : 0,
  );
}

/** Seconds by which everything in a layer has arrived (entrances, travel, keys). */
export function settleOf(
  list: readonly PlanElement[],
  entrance: number,
): number {
  let t = 0;
  eachElement(list, (el) => {
    t = Math.max(t, arrivedBy(el, entrance));
  });
  return t;
}
