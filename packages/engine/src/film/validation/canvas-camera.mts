import type { BlockProps, PropHelpers } from '../types.mjs';

import { isTarget, targetSpec } from '../target.mjs';

const camera = (v: unknown) =>
  isTarget(v) ||
  (Array.isArray(v) &&
    v.length === 4 &&
    v.every(Number.isFinite) &&
    v[2] >= 16 &&
    v[3] >= 16);

export function validateReveal(p: BlockProps, h: PropHelpers): void {
  for (const k of ['view', 'viewFrom', 'viewTall'] as const)
    if (isTarget(p[k])) targetSpec(p[k], k, h.fail);
  if (p.reveal == null) return;

  const r = p.reveal;
  if (!r || typeof r !== 'object' || Array.isArray(r))
    h.fail(
      'reveal must be {from: an element id or [ids], pad?, state?, say|cue|at, dur?}',
    );
  for (const k of Object.keys(r))
    if (
      !['from', 'pad', 'state', 'say', 'cue', 'at', 'after', 'dur'].includes(k)
    )
      h.fail(`reveal: unsupported field ${k}`);
  targetSpec({ on: r.from, pad: r.pad, state: r.state }, 'reveal', (m) =>
    h.fail(m.replace('reveal.on', 'reveal.from')),
  );
  if (r.dur != null && !(Number.isFinite(r.dur) && r.dur >= 0.4 && r.dur <= 6))
    h.fail('reveal.dur is 0.4–6 seconds (the pull back)');
  if (p.viewFrom != null)
    h.fail('reveal sets where the camera starts; drop viewFrom');
}

export function validateViews(p: BlockProps, h: PropHelpers): void {
  if (
    p.view != null &&
    p.view !== 'auto' &&
    !camera(p.view) &&
    (!Array.isArray(p.view) ||
      p.view.length !== 2 ||
      p.view.some((v) => !Number.isFinite(v) || v < 16))
  )
    h.fail(
      'view must be "auto", [width, height] or a camera rect [x, y, width, height]',
    );
  if (p.viewFrom != null && !camera(p.viewFrom))
    h.fail('viewFrom must be a camera rect [x, y, width, height]');
  if (p.viewTall != null && !camera(p.viewTall))
    h.fail(
      'viewTall must be a camera rect [x, y, width, height] (used in tall frames)',
    );
}

export function validateCameraMovement(p: BlockProps, h: PropHelpers): void {
  if (
    p.viewDrift != null &&
    !(Number.isFinite(p.viewDrift) && p.viewDrift >= 0 && p.viewDrift <= 0.2)
  )
    h.fail(
      'viewDrift must be 0–0.2 (the fraction the camera eases in during a hold)',
    );
  if (
    p.viewDur != null &&
    !(Number.isFinite(p.viewDur) && p.viewDur > 0 && p.viewDur <= 10)
  )
    h.fail('viewDur must be 0–10 seconds');
  if (p.world != null && (typeof p.world !== 'string' || !camera(p.view)))
    h.fail(
      'world must be a name, with view set to a camera rect [x, y, width, height]',
    );
}
