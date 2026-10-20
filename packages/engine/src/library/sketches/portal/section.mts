import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { AT } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
export function portalSection(context: PortalContext): CanvasElement[] {
  const { main, head, card, text } = context;
  return [
    // The section: its header and two cards, one of which is the next click.
    {
      type: 'group',
      enter: 'none',
      exit: 'fade',
      exitCue: 'CLICK2',
      exitAt: AT.CLICK2,
      exitDur: 0.3,
      children: [
        text('STEP1', head.x, head.y, 46, 'bold', 'ink', {
          enter: 'rise',
          cue: 'CLICK1',
          at: AT.CLICK1 + 0.1,
          after: 0.1,
          dur: 0.4,
          fit: main.w,
        }),
        ...[0, 1].map((i): CanvasElement => {
          const r = card(i);
          return {
            type: 'group',
            enter: 'rise',
            cue: 'CLICK1',
            at: AT.CLICK1 + 0.2 + i * 0.12,
            after: 0.2 + i * 0.12,
            dur: 0.45,
            children: [
              {
                type: 'rect',
                ...r,
                r: 20,
                fill: 'bg',
                stroke: 'line',
                width: 2,
                enter: 'none',
              } satisfies CanvasElement,
              {
                type: 'circle',
                cx: r.x + 58,
                cy: r.y + 62,
                r: 28,
                fill: i ? 'wash2' : 'wash',
                enter: 'none',
              } satisfies CanvasElement,
              text(
                i ? 'OTHER' : 'STEP2',
                r.x + 32,
                r.y + r.h - 44,
                36,
                'bold',
                'ink',
                { fit: r.w - 64, enter: 'none' },
              ),
            ],
          } satisfies CanvasElement;
        }),
        {
          type: 'rect',
          ...card(0),
          r: 20,
          fill: 'none',
          stroke: 'accent',
          width: 4,
          enter: 'fade',
          cue: 'CLICK2',
          at: AT.CLICK2 - 0.15,
          dur: 0.15,
        } satisfies CanvasElement,
      ],
    } satisfies CanvasElement,
  ];
}
