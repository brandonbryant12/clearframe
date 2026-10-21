import type { CanvasElement, Fail } from './types.mjs';

export function checkParticles(
  el: CanvasElement,
  at: string,
  fail: Fail,
): void {
  if (
    el.kind != null &&
    !['dust', 'embers', 'rain', 'snow', 'bubbles', 'stars', 'warp'].includes(
      el.kind,
    )
  )
    fail(`${at}.kind must be dust, embers, rain, snow, bubbles, stars or warp`);

  if (
    el.count != null &&
    (typeof el.count !== 'number' ||
      !Number.isInteger(el.count) ||
      el.count < 1 ||
      el.count > 400)
  )
    fail(`${at}.count must be 1–400`);
}
