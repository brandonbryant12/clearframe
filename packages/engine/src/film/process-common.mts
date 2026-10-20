export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`process: ${message}`);
}
export const count = (v: number) => Number.isInteger(v) && v >= 0 && v <= 1e6;
export const show = { at: 0, enter: 'none' };
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
    check(
      keys.includes(k),
      `unknown ${name}.${k} (it takes ${keys.join(', ')})`,
    );
}
export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};
export const ID = /^[a-z][a-z0-9-]{0,23}$/;

export const fmt = (v: number): string => v.toLocaleString('en-US');
