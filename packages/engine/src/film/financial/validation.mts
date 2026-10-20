export function requireValue(
  ok: unknown,
  message: string,
  prefix: string,
): asserts ok {
  if (!ok) throw new Error(`${prefix}: ${message}`);
}
export function keys(
  value: unknown,
  allowed: readonly string[],
  label: string,
  prefix: string,
): void {
  requireValue(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`,
    prefix,
  );
  for (const key of Object.keys(value))
    requireValue(allowed.includes(key), `unknown ${label}.${key}`, prefix);
}
export const dense = (value: unknown): boolean =>
  Array.isArray(value) &&
  Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(
    Boolean,
  );
export const integer = (
  value: unknown,
  lo: number,
  hi = Number.MAX_SAFE_INTEGER,
): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= lo &&
  value <= hi;
export function words(
  value: unknown,
  max: number,
  label: string,
  prefix: string,
): void {
  requireValue(
    typeof value === 'string' &&
      value.trim() &&
      value.length <= max &&
      !/[\r\n]/.test(value),
    `${label} needs one line up to ${max} characters`,
    prefix,
  );
}
export function required<A>(value: A | undefined | null, message: string): A {
  if (value === undefined || value === null) throw new Error(message);
  return value;
}
