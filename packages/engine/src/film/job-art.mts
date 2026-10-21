import type { Art as AuthoredArt } from '../engine/domain.mjs';
import type { HelperFrame, ArtLayers } from './types.mjs';

import { normalizeElements, roughSpec, applyRough } from './canvas.mjs';

import { glyphCheck } from './glyphs.mjs';

import { expandArt } from './sketches.mjs';

export function artLayers(
  a: AuthoredArt,
  id: string,
  frame: HelperFrame,
): ArtLayers {
  if (
    !a ||
    typeof a !== 'object' ||
    Array.isArray(a) ||
    Object.keys(a).some(
      (k) =>
        ![
          'under',
          'over',
          'rough',
          'sketch',
          'seed',
          'opacity',
          'drift',
        ].includes(k),
    )
  )
    throw new Error(
      'art must be {sketch, seed, opacity, drift, under: [...], over: [...], rough}',
    );
  if (
    a.sketch == null &&
    (a.seed != null || a.opacity != null || a.drift != null)
  )
    throw new Error('art.seed, art.opacity and art.drift require art.sketch');
  a = expandArt(a, frame);
  const state = { count: 0 };
  const fail = (m: string): never => {
    throw new Error(`art: ${m}`);
  };
  const art = {
    under: normalizeElements(a.under ?? [], 'art.under', fail, state),
    over: normalizeElements(a.over ?? [], 'art.over', fail, state),
  };
  if (a.rough != null && a.rough !== false) {
    const r = roughSpec(a.rough, 'art.rough', fail);
    applyRough(art.under, r);
    applyRough(art.over, r);
  }
  glyphCheck(art, `${id}.art`, (m) => {
    throw new Error(m);
  });
  return art;
}
