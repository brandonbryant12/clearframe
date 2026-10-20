import { check } from './check.mjs';

// One fixed signed color domain across all windows. Pale fills keep dark type legible.
export function correlationColor(value: number | null) {
  if (value === null) return '#eeeeea';
  check(
    Number.isFinite(value) && Math.abs(value) <= 1,
    'coefficient outside [-1,1]',
  );
  const base = [247, 247, 242],
    end = value < 0 ? [231, 170, 119] : [135, 176, 213],
    t = Math.abs(value);
  return (
    '#' +
    base
      .map((v, i) =>
        Math.round(v + (end[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
