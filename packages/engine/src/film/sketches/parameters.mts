import type { SketchItem, SketchParam, JsonRecord } from '../types.mjs';
export function sketchParams(s: SketchItem, given: JsonRecord | null = {}) {
  const spec = s.params ?? {};
  if (given != null && (typeof given !== 'object' || Array.isArray(given)))
    throw new Error(`sketchParams for ${s.name} must be an object`);
  const unknown = Object.keys(given ?? {}).filter((k) => !(k in spec));
  if (unknown.length)
    throw new Error(
      `sketchParams: ${s.name} has no ${unknown.join(', ')}${Object.keys(spec).length ? ` (it takes ${Object.keys(spec).join(', ')})` : ' (it takes none)'}`,
    );
  const out: JsonRecord = {};
  for (const [k, d] of Object.entries(spec)) {
    const v = given?.[k] ?? d.default;
    validateParamValue(v, d, k, s.name);
    out[k] = v;
  }
  return out;
}

function validateParam(
  x: unknown,
  d: SketchParam,
  k: string,
  name: string,
): void {
  if (d.oneOf && !d.oneOf.includes(x))
    throw new Error(
      `sketchParams.${k} for ${name} must be one of ${d.oneOf.map((o) => JSON.stringify(o)).join(', ')} (got ${JSON.stringify(x)})`,
    );
  if (typeof d.default === 'boolean' && typeof x !== 'boolean')
    throw new Error(`sketchParams.${k} for ${name} must be true or false`);
  if (typeof d.default === 'string' && !d.oneOf && typeof x !== 'string')
    throw new Error(`sketchParams.${k} for ${name} must be text`);
  if (typeof d.default === 'number' || d.min != null)
    validateNumber(x, d, k, name);
}

function validateNumber(
  x: unknown,
  d: SketchParam,
  k: string,
  name: string,
): void {
  if (typeof x !== 'number' || !Number.isFinite(x))
    throw new Error(`sketchParams.${k} for ${name} must be a number`);
  if (d.integer && !Number.isInteger(x))
    throw new Error(`sketchParams.${k} for ${name} must be a whole number`);
  if ((d.min != null && x < d.min) || (d.max != null && x > d.max))
    throw new Error(
      `sketchParams.${k} for ${name} must be ${d.min ?? '-∞'}–${d.max ?? '∞'} (got ${x})${d.hint ? `. ${d.hint}` : ''}`,
    );
}

function validateParamValue(
  v: unknown,
  d: SketchParam,
  k: string,
  name: string,
): void {
  if (d.list) {
    if (!Array.isArray(v) || !v.length)
      throw new Error(
        `sketchParams.${k} for ${name} must be a list, like ${JSON.stringify(d.default)} (got ${JSON.stringify(v)})${d.about ? `: ${d.about}` : ''}`,
      );
    if (d.length && (v.length < d.length[0] || v.length > d.length[1]))
      throw new Error(
        `sketchParams.${k} for ${name} takes ${d.length[0]}–${d.length[1]} values`,
      );
    v.forEach((x) => validateParam(x, d, k, name));
  } else validateParam(v, d, k, name);
}
