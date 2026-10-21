import { isList } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkSolid(el: CanvasElement, at: string, fail: Fail): void {
  if (
    el.shape != null &&
    !['tetra', 'cube', 'octa', 'icosa', 'dodeca', 'globe'].includes(el.shape)
  )
    fail(`${at}.shape must be tetra, cube, octa, icosa, dodeca or globe`);

  checkGlobe(el, at, fail);
  checkShade(el, at, fail);
  for (const key of ['spin', 'tilt'] as const) {
    const v = el[key];
    if (
      v != null &&
      !(Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))
    )
      fail(
        `${at}.${key} must be [x, y, z] degrees${key === 'spin' ? ' per second' : ''}`,
      );
  }

  if (
    el.perspective != null &&
    !(
      Number.isFinite(el.perspective) &&
      el.perspective >= 0 &&
      el.perspective <= 0.9
    )
  )
    fail(`${at}.perspective must be 0–0.9`);
}

function checkShade(el: CanvasElement, at: string, fail: Fail): void {
  // Lit faces instead of a wireframe: a key light, ambient fill and edge highlights.
  if (el.shade != null) {
    const s = el.shade;
    const ok =
      s === true ||
      s === false ||
      (s &&
        typeof s === 'object' &&
        !Array.isArray(s) &&
        Object.keys(s).every((k) =>
          ['light', 'ambient', 'edges'].includes(k),
        ) &&
        (s.light == null ||
          (Array.isArray(s.light) &&
            s.light.length === 3 &&
            s.light.every(Number.isFinite))) &&
        (s.ambient == null ||
          (Number.isFinite(s.ambient) && s.ambient >= 0 && s.ambient <= 1)) &&
        (s.edges == null || typeof s.edges === 'boolean'));
    if (!ok)
      fail(
        `${at}.shade must be true or {light: [x, y, z], ambient: 0–1, edges}`,
      );
    if (el.shape === 'globe')
      fail(`${at}: shade is for the polyhedra, not the globe`);
  }
}

function checkGlobe(el: CanvasElement, at: string, fail: Fail): void {
  // A globe takes places as [lat, lon] marks and [lat, lon, lat, lon] great-circle arcs.
  const coords = (v: unknown, n: number): boolean =>
    isList(v) &&
    v.length === n &&
    v.every(Number.isFinite) &&
    v.every(
      (x, i) => typeof x === 'number' && Math.abs(x) <= (i % 2 ? 180 : 90),
    );

  if (
    el.marks != null &&
    !(
      Array.isArray(el.marks) &&
      el.marks.length <= 40 &&
      el.marks.every((m) => coords(m, 2))
    )
  )
    fail(`${at}.marks must be up to 40 [lat, lon] pairs`);

  if (
    el.arcs != null &&
    !(
      Array.isArray(el.arcs) &&
      el.arcs.length <= 20 &&
      el.arcs.every((a) => coords(a, 4))
    )
  )
    fail(`${at}.arcs must be up to 20 [lat, lon, lat, lon] routes`);

  if ((el.marks || el.arcs) && el.shape !== 'globe')
    fail(`${at}: marks and arcs are for shape globe`);
}
