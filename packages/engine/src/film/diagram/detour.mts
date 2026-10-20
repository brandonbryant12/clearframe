import type { Point } from '../types.mjs';
import type { Area, Box, Centre } from './contracts.mjs';
export function detour(
  a: Centre,
  b: Centre,
  horizontal: boolean,
  others: Box[],
  {
    hw,
    hh,
    gap,
    area,
    lane,
  }: { hw: number; hh: number; gap: number; area: Area; lane: number },
): Point[] {
  const span = horizontal
    ? [Math.min(a.x, b.x), Math.max(a.x, b.x)]
    : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inSpan = others.filter((o) =>
    horizontal
      ? o.r > span[0] && o.l < span[1]
      : o.b > span[0] && o.t < span[1],
  );
  const clear = gap * 3;
  if (horizontal) {
    const above =
        Math.min(a.y - hh, b.y - hh, ...inSpan.map((o) => o.t)) - clear,
      below = Math.max(a.y + hh, b.y + hh, ...inSpan.map((o) => o.b)) + clear;
    const up = above >= area.y - hh * 0.6 || below > area.y + area.h + hh * 0.6;
    const y = up ? above : below,
      s = up ? -1 : 1;
    return [
      [a.x + lane, a.y + s * (hh + gap)],
      [a.x + lane, y],
      [b.x + lane, y],
      [b.x + lane, b.y + s * (hh + gap)],
    ];
  }
  const left = Math.min(a.x - hw, b.x - hw, ...inSpan.map((o) => o.l)) - clear,
    right = Math.max(a.x + hw, b.x + hw, ...inSpan.map((o) => o.r)) + clear;
  const goLeft =
    left >= area.x - hw * 0.4 || right > area.x + area.w + hw * 0.4;
  const x = goLeft ? left : right,
    s = goLeft ? -1 : 1;
  return [
    [a.x + s * (hw + gap), a.y + lane],
    [x, a.y + lane],
    [x, b.y + lane],
    [b.x + s * (hw + gap), b.y + lane],
  ];
}
