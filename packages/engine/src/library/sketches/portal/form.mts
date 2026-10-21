import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
export function portalForm(context: PortalContext): CanvasElement[] {
  const { main, centre, head, fieldY, box, save, text } = context;
  return [
    // The form: one field, its old value replaced by the new one, and a save button.
    {
      type: 'group',
      enter: 'rise',
      cue: 'CLICK2',
      at: AT.CLICK2 + 0.25,
      after: 0.25,
      dur: 0.45,
      children: [
        text('STEP2', head.x, head.y, 46, 'bold', 'ink', {
          enter: 'none',
          fit: main.w,
        }),
        text('FIELD', main.x, fieldY, 30, 'semibold', 'muted', {
          enter: 'none',
          fit: main.w,
        }),
        {
          type: 'rect',
          ...box,
          r: 16,
          fill: 'bg',
          stroke: 'line',
          width: 2,
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'rect',
          ...box,
          r: 16,
          fill: 'none',
          stroke: 'accent',
          width: 5,
          enter: 'fade',
          cue: 'CHANGE',
          at: AT.CHANGE,
          dur: 0.2,
        } satisfies CanvasElement,
        text(
          'OLD',
          box.x + 36,
          round(box.y + box.h / 2 + 22),
          64,
          'bold',
          'muted',
          {
            fit: box.w - 72,
            enter: 'none',
            exit: 'fade',
            exitCue: 'CHANGE',
            exitAt: AT.CHANGE,
            exitDur: 0.15,
          },
        ),
        text(
          'NEW',
          box.x + 36,
          round(box.y + box.h / 2 + 22),
          64,
          'bold',
          'accent',
          {
            fit: box.w - 72,
            enter: 'type',
            cue: 'CHANGE',
            at: AT.CHANGE + 0.2,
            after: 0.2,
            dur: 0.4,
          },
        ),
        {
          type: 'group',
          enter: 'none',
          origin: centre(save),
          keys: [
            {
              cue: 'SAVE',
              at: AT.SAVE,
              dur: 0.3,
              ease: 'thereAndBack',
              scale: 0.92,
            },
          ],
          children: [
            {
              type: 'rect',
              ...save,
              r: 38,
              fill: 'accent',
              enter: 'none',
            } satisfies CanvasElement,
            text(
              'Save',
              centre(save)[0],
              centre(save)[1] + 11,
              32,
              'bold',
              'bg',
              { anchor: 'middle', enter: 'none' },
            ),
          ],
        } satisfies CanvasElement,
      ],
    } satisfies CanvasElement,
  ];
}
