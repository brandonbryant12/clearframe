import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
export function portalNavigation(context: PortalContext): CanvasElement[] {
  const { T, items, item, label, text } = context;
  return [
    // The menu: the section's row lights up on the first click.
    {
      type: 'rect',
      ...item(0),
      r: 14,
      fill: 'wash',
      enter: 'none',
      exit: 'fade',
      exitCue: 'CLICK1',
      exitAt: AT.CLICK1,
      exitDur: 0.2,
    } satisfies CanvasElement,

    {
      type: 'rect',
      ...item(1),
      r: 14,
      fill: 'wash',
      enter: 'fade',
      cue: 'CLICK1',
      at: AT.CLICK1,
      dur: 0.25,
    } satisfies CanvasElement,

    ...items.map((t, i) => {
      const r = item(i);
      return text(
        t,
        T ? round(r.x + r.w / 2) : r.x + 22,
        round(r.y + r.h / 2 + label * 0.36),
        label,
        'semibold',
        'ink',
        {
          anchor: T ? 'middle' : 'start',
          fit: r.w - 30,
          enter: 'none',
        },
      );
    }),
  ];
}
