import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
export function portalHome(context: PortalContext): CanvasElement[] {
  const { main, head, text } = context;
  return [
    // Home: a greeting and quiet placeholder rows, gone when the section opens.
    {
      type: 'group',
      enter: 'none',
      at: 0,
      exit: 'fade',
      exitCue: 'CLICK1',
      exitAt: AT.CLICK1,
      exitDur: 0.25,
      children: [
        text('Welcome back', head.x, head.y, 46, 'bold', 'ink', {
          enter: 'none',
        }),
        ...[0, 1, 2].map(
          (i): CanvasElement =>
            ({
              type: 'rect',
              x: main.x,
              y: main.y + 100 + i * 70,
              w: round(main.w * (0.9 - i * 0.2)),
              h: 30,
              r: 15,
              fill: 'wash',
              enter: 'none',
            }) satisfies CanvasElement,
        ),
      ],
    } satisfies CanvasElement,
  ];
}
