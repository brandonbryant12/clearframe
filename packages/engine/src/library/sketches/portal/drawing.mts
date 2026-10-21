import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp, round } from '../../../film/sketch-kit.mjs';
import { AT, cursorPath } from './common.mjs';
import type { PortalContext } from './contracts.mjs';
import { portalWindow } from './window.mjs';
import { portalNavigation } from './navigation.mjs';
import { portalHome } from './home.mjs';
import { portalSection } from './section.mjs';
import { portalForm } from './form.mjs';
import { portalConfirmation } from './confirmation.mjs';
export function portalDrawing(context: PortalContext): SketchDrawing {
  const { w, phone, vx, vy, lean, drift, start, move, ripple } = context;

  return {
    elements: crisp([
      {
        type: 'group',
        enter: 'rise',
        at: 0,
        dur: 0.6,
        origin: [vx, vy],
        shadow: { blur: 48, dy: 26, opacity: 0.22 },
        // The enlarged result: the whole window leans in on the saved value.
        // It also drifts toward the middle of the frame, so the new value ends up near the centre.
        keys: [
          {
            cue: 'SAVE',
            at: AT.SAVE + 0.9,
            after: 0.9,
            dur: 1.3,
            ease: 'inOut',
            scale: lean,
            x: round((w / 2 - vx) * 0.55),
            y: round(drift),
          },
        ],
        children: [
          ...portalWindow(context),
          ...portalNavigation(context),
          ...portalHome(context),
          ...portalSection(context),
          ...portalForm(context),
          ...portalConfirmation(context),
        ],
      } satisfies CanvasElement,
      ripple(0, 'CLICK1'),
      ripple(1, 'CLICK2'),
      ripple(2, 'CHANGE'),
      ripple(3, 'SAVE'),
      // The cursor: on its way to the first target as the scene opens, then to each next one
      // just after a click; it leaves once the work is saved.
      {
        // A phone is tapped: a soft fingertip instead of a pointer.
        ...(phone
          ? ({
              type: 'circle',
              cx: start[0],
              cy: start[1],
              r: 30,
              fill: 'ink',
              opacity: 0.28,
              stroke: 'surface',
              width: 3,
            } satisfies CanvasElement)
          : ({
              type: 'path',
              d: cursorPath(start[0], start[1]),
              fill: 'ink',
              stroke: 'surface',
              width: 3,
              join: 'round',
            } satisfies CanvasElement)),
        enter: 'fade',
        at: 0.2,
        dur: 0.3,
        keys: [
          move(0, null, 0.45),
          move(1, 'CLICK1', AT.CLICK1 + 0.45),
          move(2, 'CLICK2', AT.CLICK2 + 0.45),
          move(3, 'CHANGE', AT.CHANGE + 0.45),
          {
            cue: 'SAVE',
            at: AT.SAVE + 0.7,
            after: 0.7,
            dur: 0.3,
            opacity: 0,
          },
        ],
      },
    ]),
  };
}
