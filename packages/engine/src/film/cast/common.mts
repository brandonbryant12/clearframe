export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`cast: ${message}`);
}
export const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export function required<A>(value: A | null | undefined, name: string): A {
  if (value == null) throw new Error(`cast: missing ${name}`);
  return value;
}
export function oneId(value: string | string[] | undefined): string {
  if (typeof value !== 'string')
    throw new Error('cast: a destination names one object');
  return value;
}
export function objectAt<A>(
  items: ReadonlyMap<string, A>,
  id: string | undefined,
): A {
  return required(items.get(required(id, 'object id')), `object ${id}`);
}
export function hash(value: unknown): number {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}
export const FORMS = [
  'scatter',
  'row',
  'column',
  'line',
  'ring',
  'cluster',
  'hero',
  'exit',
  'swap',
  'wave',
  'mark',
  'camera',
  'fill',
  'emerge',
  'merge',
  'split',
  'travel',
];
export const FILL_TONES = {
  accent: 'accent',
  accent2: 'accent2',
  surface: 'surface',
  ink: 'invert',
};
export function fillTone(color: string | undefined) {
  return Object.entries(FILL_TONES).find(
    ([name]) => name === (color ?? 'accent'),
  )?.[1];
}
export const LOOKS = ['tiles', 'drawn', 'print', 'pixel'];
export const MARKS = ['circle', 'underline', 'cross', 'arrow'];
export const ENTERS = ['pop', 'drop', 'rise', 'left', 'right', 'fade', 'none'];
export const COLORS = [
  'accent',
  'accent2',
  'positive',
  'negative',
  'ink',
  'muted',
  'surface',
];
export function own(
  value: unknown,
  keys: readonly string[],
  name: string,
): void {
  check(
    value && typeof value === 'object' && !Array.isArray(value),
    `${name} must be an object`,
  );
  for (const key of Object.keys(value)) {
    const hint =
      name === 'cast' && key === 'size'
        ? ': size is set on each object (objects[].size, 48–360 px); a camera formation ({"form": "camera", "zoom": 1.4}) enlarges the whole cast'
        : '';
    check(keys.includes(key), `unknown ${name}.${key}${hint}`);
  }
}
