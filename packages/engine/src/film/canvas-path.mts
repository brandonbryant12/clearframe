import type { Fail } from './types.mjs';

export function pathData(d: unknown, where: string, fail: Fail): void {
  if (typeof d !== 'string' || !d.trim() || d.length > 12000)
    fail(`${where} must be SVG path data up to 12,000 characters`);
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(d) || !/^\s*[Mm]/.test(d))
    fail(
      `${where} must be plain SVG path data starting with M (commands MLHVCSQTAZ and numbers)`,
    );
}

/** End and control points of SVG path data, absolute (enough for a bounding box). */
export function pathPoints(d: string): number[][] {
  const out: number[][] = [];
  let x = 0,
    y = 0;
  for (const [, cmd, args] of d.matchAll(
    /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g,
  )) {
    ({ x, y } = appendCommand(out, x, y, cmd, args));
  }
  return out;
}

function appendCommand(
  out: number[][],
  x: number,
  y: number,
  cmd: string,
  args: string,
): { x: number; y: number } {
  const ARITY = {
    m: 2,
    l: 2,
    t: 2,
    h: 1,
    v: 1,
    c: 6,
    s: 4,
    q: 4,
    a: 7,
    z: 0,
  } satisfies Record<string, number>;
  const n =
      Object.entries(ARITY).find(([name]) => name === cmd.toLowerCase())?.[1] ??
      0,
    rel = cmd === cmd.toLowerCase(),
    v = args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
  for (let i = 0; n && i + n <= v.length; i += n) {
    const g = v.slice(i, i + n),
      k = cmd.toLowerCase();
    if (k === 'h') x = rel ? x + g[0] : g[0];
    else if (k === 'v') y = rel ? y + g[0] : g[0];
    else {
      const pairs =
        k === 'a'
          ? [g.slice(5)]
          : Array.from({ length: n / 2 }, (_, j) => g.slice(2 * j, 2 * j + 2));
      pairs.forEach(([px, py], j) => {
        const p = rel ? [x + px, y + py] : [px, py];
        out.push(p);
        if (j === pairs.length - 1) [x, y] = p;
      });
      continue;
    }
    out.push([x, y]);
  }
  return { x, y };
}
