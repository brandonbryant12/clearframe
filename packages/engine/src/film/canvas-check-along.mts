import type { CanvasElement, Fail } from './types.mjs';

import { EASES } from './canvas-catalog.mjs';

import { pathData } from './canvas-path.mjs';

export function checkAlong(el: CanvasElement, at: string, fail: Fail): void {
  if (el.along != null) {
    const r = el.along;
    if (!r || typeof r !== 'object' || typeof r.d !== 'string')
      fail(`${at}.along needs path data d`);
    for (const key of Object.keys(r))
      if (
        ![
          'd',
          'at',
          'say',
          'cue',
          'after',
          'dur',
          'ease',
          'rotate',
          'loop',
        ].includes(key)
      )
        fail(`${at}.along: unsupported field ${key}`);
    pathData(r.d, `${at}.along.d`, fail);
    if (r.ease != null && !EASES.includes(r.ease))
      fail(`${at}.along.ease must be one of ${EASES.join(', ')}`);
  }
}
