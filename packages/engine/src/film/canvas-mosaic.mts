import { decodeMosaicSpec } from './canvas-schema.mjs';
import { finite, isRecord } from './guards.mjs';
import type { CanvasElement, Fail, MosaicSpec } from './types.mjs';
import { MOSAIC_STYLES } from './canvas-catalog.mjs';
import { eachElement } from './canvas-traverse.mjs';
import { elementsExtent } from './canvas-extent.mjs';

/** Apply a canvas-wide hand-drawn default to every drawable element that has not opted out. */
export const MOSAIC_TYPES = new Set<string>([
  'rect',
  'circle',
  'ellipse',
  'line',
  'path',
  'poly',
]);

/** Validate a mosaic spec: `true` or {tile, gap, jitter, flow, outline, build, shade, shine, grout, axis, seed}. */
export function mosaicSpec(m: unknown, at: string, fail: Fail): MosaicSpec {
  if (m === true) return {};
  if (!isRecord(m)) fail(`${at} must be true or an object`);
  const ranges = {
    tile: [3, 200],
    gap: [0, 60],
    jitter: [0, 1],
    shade: [0, 0.6],
    shine: [0, 1],
    glint: [0, 1],
    halo: [0, 6],
    spread: [0, 4000],
    axis: [-360, 360],
    seed: [0, 1e9],
  } satisfies Record<string, [number, number]>;
  for (const k of Object.keys(m)) {
    if (
      ![
        'tile',
        'gap',
        'jitter',
        'flow',
        'outline',
        'build',
        'from',
        'spread',
        'shade',
        'shine',
        'glint',
        'grout',
        'axis',
        'seed',
        'recolor',
        'halo',
        'knockout',
        'style',
      ].includes(k)
    )
      fail(`${at}: unsupported field ${k}`);
    const range = Object.entries(ranges).find(([name]) => name === k)?.[1];
    const v = m[k];
    if (range && !(finite(v) && v >= range[0] && v <= range[1]))
      fail(`${at}.${k} must be ${range[0]}–${range[1]}`);
  }
  // Its fields are checked here and above.
  const spec = decodeMosaicSpec(m);
  checkMosaicStyle(spec, at, fail);
  checkRecolor(spec, at, fail);
  return {
    ...spec,
    ...(spec.recolor ? { recolor: spec.recolor.map((r) => ({ ...r })) } : {}),
  };
}

/** A canvas-level mosaic: every shape without its own setting is laid in tiles. */
export function applyMosaic(list: CanvasElement[], spec: MosaicSpec): void {
  eachElement(list, (el) => {
    if (!MOSAIC_TYPES.has(el.type) || el.mosaic !== undefined || el.dash)
      return;
    // Backdrop-sized shapes (a ground, a sky) stay flat; the mosaic backdrop covers them.
    const e = elementsExtent([el]);
    if (e && e.w * e.h > 4e6) return;
    el.mosaic = { ...spec };
  });
}

function checkMosaicStyle(spec: MosaicSpec, at: string, fail: Fail): void {
  if (spec.flow != null && !['rows', 'rings', 'contour'].includes(spec.flow))
    fail(`${at}.flow must be rows, rings or contour`);
  if (spec.style != null && !MOSAIC_STYLES.includes(spec.style))
    fail(`${at}.style must be ${MOSAIC_STYLES.join(', ')}`);
  if (
    spec.build != null &&
    !['sweep', 'radial', 'random', 'fly'].includes(spec.build)
  )
    fail(`${at}.build must be sweep, radial, random or fly`);
  if (
    spec.from != null &&
    !(
      Array.isArray(spec.from) &&
      spec.from.length === 2 &&
      spec.from.every(Number.isFinite)
    )
  )
    fail(`${at}.from must be [x, y]`);
  if (spec.outline != null && typeof spec.outline !== 'boolean')
    fail(`${at}.outline must be true or false`);
}
function checkRecolor(spec: MosaicSpec, at: string, fail: Fail): void {
  if (spec.recolor != null) {
    if (!Array.isArray(spec.recolor) || spec.recolor.length > 8)
      fail(`${at}.recolor must be a list of up to 8 fronts`);
    spec.recolor.forEach((r, i) => {
      const where = `${at}.recolor[${i}]`;
      if (!r || typeof r !== 'object')
        fail(`${where} must be {say|at, dur, fill, axis, share}`);
      for (const k of Object.keys(r))
        if (!['say', 'at', 'dur', 'fill', 'axis', 'share'].includes(k))
          fail(`${where}: unsupported field ${k}`);
      if (r.say == null && r.at == null)
        fail(`${where} needs say (a spoken cue) or at (seconds)`);
      if (r.fill == null)
        fail(`${where} needs a fill (colour, token or gradient)`);
      if (
        r.share != null &&
        !(Number.isFinite(r.share) && r.share > 0 && r.share <= 1)
      )
        fail(`${where}.share must be 0–1`);
      if (
        r.dur != null &&
        !(Number.isFinite(r.dur) && r.dur > 0 && r.dur <= 20)
      )
        fail(`${where}.dur must be 0–20 s`);
    });
  }
}
