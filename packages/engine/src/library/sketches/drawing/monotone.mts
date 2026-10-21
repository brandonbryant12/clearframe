import type { Point } from '../../../film/contracts/primitives.mjs';

function slope(differences: number[], index: number, count: number): number {
  if (index === 0) return differences[0];
  if (index === count - 1) return differences[count - 2];
  if (differences[index - 1] * differences[index] <= 0) return 0;
  return (differences[index - 1] + differences[index]) / 2;
}

/** Fritsch-Carlson interpolation keeps every segment between its stated values. */
export function monotone(keys: readonly Point[]): (time: number) => number {
  const count = keys.length;
  const xs = keys.map((key) => key[0]);
  const ys = keys.map((key) => key[1]);
  const differences = xs
    .slice(0, -1)
    .map((x, index) => (ys[index + 1] - ys[index]) / (xs[index + 1] - x));
  const slopes = ys.map((_, index) => slope(differences, index, count));
  for (let index = 0; index < count - 1; index++) {
    if (differences[index] === 0) {
      slopes[index] = slopes[index + 1] = 0;
      continue;
    }
    const a = slopes[index] / differences[index];
    const b = slopes[index + 1] / differences[index];
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      slopes[index] = (3 * a * differences[index]) / Math.sqrt(magnitude);
      slopes[index + 1] = (3 * b * differences[index]) / Math.sqrt(magnitude);
    }
  }
  return (time) => {
    let index = 0;
    while (index < count - 2 && time > xs[index + 1]) index++;
    const h = xs[index + 1] - xs[index];
    const u = Math.min(1, Math.max(0, (time - xs[index]) / h));
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * ys[index] +
      (u3 - 2 * u2 + u) * h * slopes[index] +
      (-2 * u3 + 3 * u2) * ys[index + 1] +
      (u3 - u2) * h * slopes[index + 1]
    );
  };
}
