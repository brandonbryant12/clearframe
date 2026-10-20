import { decodePrintSettings } from './canvas-schema.mjs';
import { finite, isRecord } from './guards.mjs';
import type {
  CanvasElement,
  Fail,
  PrintSettings,
  PrintSpec,
} from './types.mjs';
import { PRINTS } from './canvas-catalog.mjs';
import { isColor } from './canvas-material.mjs';
import { eachElement } from './canvas-traverse.mjs';
import { elementsExtent } from './canvas-extent.mjs';

/**
 * Validate a print finish: a preset name (`benday`, `halftone`, `engraving`, `newsprint`,
 * `letterpress`) or {screen: dots|lines|none, cell, angle, tone, axis, register, wear, ink}.
 * Presets pass through as names; the renderer holds their values.
 */
export function printSpec(p: unknown, at: string, fail: Fail): PrintSpec {
  if (typeof p === 'string') {
    if (!PRINTS.includes(p))
      fail(`${at} must be one of ${PRINTS.join(', ')} or an object`);
    return p;
  }
  if (!isRecord(p))
    fail(
      `${at} must be a preset (${PRINTS.join(', ')}) or {screen, cell, angle, tone, axis, register, wear, ink}`,
    );
  for (const k of Object.keys(p))
    if (
      ![
        'screen',
        'cell',
        'angle',
        'tone',
        'axis',
        'register',
        'wear',
        'ink',
      ].includes(k)
    )
      fail(`${at}: unsupported field ${k}`);
  // Its fields are checked below.
  const spec = decodePrintSettings(p);
  checkPrintScreen(spec, at, fail);
  checkPrintInk(spec, at, fail);
  const tone = spec.tone,
    register = spec.register;
  return {
    ...spec,
    ...(Array.isArray(tone) ? { tone: [tone[0], tone[1]] } : {}),
    ...(register ? { register: [register[0], register[1]] } : {}),
  };
}

export const PRINT_TYPES = new Set<string>([
  'rect',
  'circle',
  'ellipse',
  'path',
  'poly',
  'image',
  'text',
]);

/**
 * A canvas-level print (`spec`, or null for none): every shape without its own finish is
 * printed the same way. Always called, so `print: false` opt-outs are removed either way.
 */
export function applyPrint(
  list: CanvasElement[],
  spec: PrintSpec | null,
): void {
  eachElement(list, (el) => {
    if (el.print === false) {
      delete el.print;
      return;
    }
    if (
      !spec ||
      !['rect', 'circle', 'ellipse', 'path', 'poly'].includes(el.type) ||
      el.print !== undefined
    )
      return;
    // Frame-sized shapes (a sky, a ground) stay flat, so no register shift opens an edge.
    const e = elementsExtent([el]);
    if (e && e.w * e.h > 1.5e6) return;
    el.print = typeof spec === 'string' ? spec : { ...spec };
  });
}

function checkPrintInk(spec: PrintSettings, at: string, fail: Fail): void {
  const unit = (v: unknown): v is number => finite(v) && v >= 0 && v <= 1;
  if (
    spec.tone != null &&
    !(
      unit(spec.tone) ||
      (Array.isArray(spec.tone) &&
        spec.tone.length === 2 &&
        spec.tone.every(unit))
    )
  )
    fail(`${at}.tone must be 0–1 or [from, to] (ink coverage)`);
  checkRegistration(spec, at, fail);
  if (spec.wear != null && !unit(spec.wear)) fail(`${at}.wear must be 0–1`);
  if (
    spec.ink != null &&
    (typeof spec.ink !== 'string' || !isColor(spec.ink) || spec.ink === 'none')
  )
    fail(`${at}.ink must be a palette token or #rrggbb`);
}

function checkRegistration(spec: PrintSettings, at: string, fail: Fail): void {
  if (
    spec.register != null &&
    !(
      Array.isArray(spec.register) &&
      spec.register.length === 2 &&
      spec.register.every((v) => finite(v) && Math.abs(v) <= 60)
    )
  )
    fail(`${at}.register must be [dx, dy] up to 60 px`);
}

function checkPrintScreen(spec: PrintSettings, at: string, fail: Fail): void {
  if (spec.screen != null && !['dots', 'lines', 'none'].includes(spec.screen))
    fail(`${at}.screen must be dots, lines or none`);
  if (
    spec.cell != null &&
    !(Number.isFinite(spec.cell) && spec.cell >= 2 && spec.cell <= 160)
  )
    fail(`${at}.cell must be 2–160 px`);
  for (const k of ['angle', 'axis'] as const) {
    const v = spec[k];
    if (v != null && !(finite(v) && Math.abs(v) <= 360))
      fail(`${at}.${k} must be degrees`);
  }
}
