import { decodeShineSpec, decodeMaterialSettings } from './canvas-schema.mjs';

import { finite, isList, isRecord } from './guards.mjs';
import type { Fail, JsonRecord, MaterialSpec, ShineSpec } from './types.mjs';
import { COLOR_TOKENS, MATERIALS } from './canvas-catalog.mjs';

export const isColor = (v: unknown): v is string =>
  typeof v === 'string' &&
  (COLOR_TOKENS.includes(v) || /^#[\da-f]{6}$/i.test(v));

/**
 * A light sweep across an element (a title catching the light): `{at|say, dur, color, width,
 * angle, opacity, every}`. `every` repeats the sweep after that many seconds.
 */
/** A material: a preset name, or {map: preset | [2–8 colours], depth, soften, flow, stripe, angle, grain, gain}. */
export function materialSpec(
  v: unknown,
  where: string,
  fail: Fail,
): MaterialSpec {
  if (typeof v === 'string') {
    if (!MATERIALS.includes(v))
      fail(`${where} must be one of ${MATERIALS.join(', ')} or an object`);
    return v;
  }
  if (!isRecord(v)) fail(`${where} must be a preset name or an object`);
  for (const k of Object.keys(v))
    if (
      ![
        'map',
        'depth',
        'soften',
        'flow',
        'stripe',
        'angle',
        'grain',
        'gain',
      ].includes(k)
    )
      fail(`${where}: unsupported field ${k}`);
  checkMaterialFields(v, where, fail);
  // Checked above; returned as authored.
  return decodeMaterialSettings(v);
}

export function shineSpec(v: unknown, where: string, fail: Fail): ShineSpec {
  const spec = v === true ? {} : v;
  if (!isRecord(spec))
    fail(
      `${where} must be true or {at|say, dur, color, width, angle, opacity, every}`,
    );
  for (const k of Object.keys(spec))
    if (
      ![
        'at',
        'say',
        'cue',
        'after',
        'dur',
        'color',
        'width',
        'angle',
        'opacity',
        'every',
      ].includes(k)
    )
      fail(`${where}: unsupported field ${k}`);
  const range = (k: string, lo: number, hi: number): void => {
    const x = spec[k];
    if (x != null && (!finite(x) || x < lo || x > hi))
      fail(`${where}.${k} must be ${lo}–${hi}`);
  };
  range('dur', 0.2, 6);
  range('width', 0.05, 1);
  range('angle', -80, 80);
  range('opacity', 0, 1);
  range('every', 1, 60);
  range('at', 0, 1e6);
  if (spec.color != null && (!isColor(spec.color) || spec.color === 'none'))
    fail(`${where}.color must be a palette colour`);
  // Checked above (say, cue and after are read where the beat resolves its cues).
  return decodeShineSpec(spec);
}

function checkMaterialFields(v: JsonRecord, where: string, fail: Fail): void {
  if (v.map != null) {
    const map = v.map;
    const ok =
      (typeof map === 'string' && MATERIALS.includes(map)) ||
      (isList(map) &&
        map.length >= 2 &&
        map.length <= 8 &&
        map.every((c) => isColor(c) && c !== 'none'));
    if (!ok)
      fail(
        `${where}.map must be a preset name or 2–8 colours (tokens or #rrggbb), cold rim to hot core`,
      );
  }
  for (const k of [
    'depth',
    'soften',
    'flow',
    'stripe',
    'angle',
    'grain',
    'gain',
  ])
    if (v[k] != null && !finite(v[k])) fail(`${where}.${k} must be a number`);
  for (const [k, lo, hi] of [
    ['depth', 0.5, 120],
    ['soften', 0, 60],
    ['stripe', 0, 1],
    ['grain', 0, 1],
    ['gain', 0.2, 4],
  ] as const) {
    const x = v[k];
    if (finite(x) && (x < lo || x > hi))
      fail(`${where}.${k} must be ${lo}–${hi}`);
  }
}
