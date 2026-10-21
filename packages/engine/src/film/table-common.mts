export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`table: ${message}`);
}
export const ID = /^[a-z][a-z0-9-]{0,23}$/;
export function own(
  o: unknown,
  keys: string[],
  name: string,
): asserts o is Record<string, unknown> {
  check(
    o != null && typeof o === 'object' && !Array.isArray(o),
    `${name} must be an object`,
  );
  for (const k of Object.keys(o))
    check(keys.includes(k), `unknown ${name}.${k}`);
}
export const label = (v: unknown, name: string, max = 80): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};
export const shown = { at: 0, enter: 'none' };
