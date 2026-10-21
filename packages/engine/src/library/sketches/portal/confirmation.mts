import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { AT } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
export function portalConfirmation(context: PortalContext): CanvasElement[] {
  const { centre, toast, text } = context;
  return [
    // The confirmation.
    {
      type: 'group',
      enter: 'pop',
      cue: 'SAVE',
      at: AT.SAVE + 0.35,
      after: 0.35,
      dur: 0.4,
      origin: centre(toast),
      children: [
        {
          type: 'rect',
          ...toast,
          r: 46,
          fill: 'ink',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'circle',
          cx: toast.x + 48,
          cy: centre(toast)[1],
          r: 22,
          fill: 'positive',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'path',
          d: `M ${toast.x + 37} ${centre(toast)[1]} L ${toast.x + 45} ${centre(toast)[1] + 9} L ${toast.x + 60} ${centre(toast)[1] - 8}`,
          fill: 'none',
          stroke: 'bg',
          width: 5,
          cap: 'round',
          join: 'round',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'DONE',
          toast.x + 90,
          centre(toast)[1] + 11,
          32,
          'semibold',
          'bg',
          { fit: toast.w - 120, enter: 'none' },
        ),
      ],
    } satisfies CanvasElement,
  ];
}
