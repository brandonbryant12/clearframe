import { isRecord } from './errors.mjs';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function inputIds(items: unknown, name: string): string[] {
  if (!Array.isArray(items)) return [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (!isRecord(item)) continue;
    const id = item.id;
    if (typeof id !== 'string' || !SLUG.test(id)) {
      errors.push(`${name}[${index}].id must be a slug`);
    } else if (seen.has(id)) {
      errors.push(
        `duplicate ${name === 'beats' ? 'beat' : 'asset'} id "${id}"`,
      );
    } else {
      seen.add(id);
    }
  }
  return errors;
}

function beatNumbers(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const errors: string[] = [];
  for (const [index, beat] of items.entries()) {
    if (!isRecord(beat)) continue;
    if (beat.duration != null && (!finite(beat.duration) || beat.duration <= 0))
      errors.push(`beats[${index}].duration must be > 0`);
    for (const key of ['lead', 'tail', 'hold', 'min']) {
      const value = beat[key];
      if (value != null && (!finite(value) || value < 0))
        errors.push(`beats[${index}].${key} must be nonnegative`);
    }
  }
  return errors;
}

/** Report independent input faults even when one field prevents full decoding. */
export function storyboardInputErrors(input: unknown): string[] {
  if (!isRecord(input)) return [];
  return [
    ...inputIds(input.beats, 'beats'),
    ...inputIds(input.assets, 'assets'),
    ...beatNumbers(input.beats),
  ];
}
