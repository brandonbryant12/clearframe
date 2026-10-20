import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { FINDS } from './common.mjs';
import type { SearchlightContext } from './contracts.mjs';
export function searchlightFinds(context: SearchlightContext): CanvasElement[] {
  const { finds } = context;
  return [
    ...finds.map(
      (f, i): CanvasElement =>
        ({
          type: 'group',
          id: `find-${i + 1}`,
          enter: 'none',
          at: 0,
          children: FINDS[i](f.x, f.b),
        }) satisfies CanvasElement,
    ),
  ];
}
