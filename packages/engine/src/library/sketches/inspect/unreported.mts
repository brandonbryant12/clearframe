import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { inspectView } from './view.mjs';
export function inspectUnreported(
  context: ReturnType<typeof inspectView>,
): SketchDrawing {
  const { marks, markEls, O, lean, cardGroup } = context;
  return {
    elements: crisp([
      {
        type: 'group',
        enter: 'none',
        cue: 'OPEN',
        at: AT.OPEN,
        origin: O,
        keys: marks.map(lean),
        children: [cardGroup, ...markEls],
      } satisfies CanvasElement,
    ]),
  };
}
