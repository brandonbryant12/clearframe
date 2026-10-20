import { decodeRoughSpec } from './canvas-schema.mjs';
import { finite, isRecord, oneOf } from './guards.mjs';
import type { CanvasElement, Fail, RoughSpec, JsonRecord } from './types.mjs';
import { eachElement } from './canvas-traverse.mjs';

/** Hand-drawn stroke settings: `true` or {amount, passes, boil, fill: hachure|solid, gap, angle, hatchWidth}. */
export function roughSpec(
  value: unknown,
  where: string,
  fail: Fail,
): RoughSpec {
  const r = value === true ? {} : value;
  if (!isRecord(r))
    fail(
      `${where} must be true or {amount, passes, boil, fill, gap, angle, hatchWidth}`,
    );
  checkRoughFields(r, where, fail);
  // Every field is a number (fill a name), checked above.
  const spec = decodeRoughSpec(r);
  if (spec.amount != null && (spec.amount < 0 || spec.amount > 40))
    fail(`${where}.amount must be 0–40`);
  if (
    spec.passes != null &&
    (!Number.isInteger(spec.passes) || spec.passes < 1 || spec.passes > 3)
  )
    fail(`${where}.passes must be 1–3`);
  if (spec.boil != null && (spec.boil < 0 || spec.boil > 30))
    fail(`${where}.boil must be 0–30 re-draws per second`);
  return { ...spec };
}

export const ROUGH_TYPES = new Set<string>([
  'rect',
  'circle',
  'ellipse',
  'line',
  'path',
  'poly',
]);

export function applyRough(list: CanvasElement[], rough: RoughSpec): void {
  eachElement(list, (el) => {
    if (ROUGH_TYPES.has(el.type) && el.rough === undefined && !el.dash)
      el.rough = { ...rough };
  });
}

function checkRoughFields(r: JsonRecord, where: string, fail: Fail): void {
  for (const [k, v] of Object.entries(r)) {
    if (k === 'fill') {
      if (!oneOf(['hachure', 'solid'], v))
        fail(`${where}.fill must be hachure or solid`);
      continue;
    }
    if (!['amount', 'passes', 'boil', 'gap', 'angle', 'hatchWidth'].includes(k))
      fail(`${where}: unsupported field ${k}`);
    if (!finite(v)) fail(`${where}.${k} must be a number`);
  }
}
