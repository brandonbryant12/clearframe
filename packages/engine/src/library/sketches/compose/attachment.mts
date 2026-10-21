import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeButtons } from './buttons.mjs';

export function composeAttachment(context: ReturnType<typeof composeButtons>) {
  const { cued, text, k, s, file, centre, clipIcon, ui } = context;

  // The attachment: shakes and greys on OLD; on LINK it lights, lifts as it uploads, and turns
  // into the link: the link's card fades in over it where it hangs, then settles into place.
  const [fcx, fcy] = centre(file);

  const fileTile = s.chip - 28;

  ui.push({
    type: 'group',
    enter: 'none',
    at: 0,
    origin: [fcx, fcy],
    keys: [
      cued('OLD', 0.15, { dur: 0.6, ease: 'wiggle', x: round(12 * k) }),
      cued('OLD', 0.15, { dur: 0.45, opacity: 0.5 }),
      cued('LINK', 0, { dur: 0.25, opacity: 1, y: round(-10 * k) }),
      cued('LINK', 0.72, { dur: 0, opacity: 0 }),
    ],
    children: [
      {
        type: 'rect',
        ...file,
        r: round(16 * k),
        fill: 'bg',
        stroke: 'line',
        width: 2,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'rect',
        x: file.x + 14,
        y: file.y + 14,
        w: fileTile,
        h: fileTile,
        r: round(12 * k),
        fill: 'wash2',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'icon',
        name: 'file',
        x: round(file.x + 14 + fileTile / 2),
        y: fcy,
        size: round(fileTile * 0.56),
        stroke: 'accent2',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'FILE',
        file.x + 14 + fileTile + 22,
        fcy + s.chipFs * 0.36,
        s.chipFs,
        'semibold',
        'ink',
        { fit: file.w - fileTile - 36 - 22 - 64 },
      ),
      clipIcon(file.x + file.w - round(36 * k), fcy, 'muted'),
      // The upload: the chip lights in the link's colour and a bar fills along its foot.
      {
        type: 'group',
        enter: 'fade',
        dur: 0.2,
        ...cued('LINK'),
        children: [
          {
            type: 'rect',
            ...file,
            r: round(16 * k),
            fill: 'accent2',
            enter: 'none',
          } satisfies CanvasElement,
          {
            type: 'icon',
            name: 'file',
            x: round(file.x + 14 + fileTile / 2),
            y: fcy,
            size: round(fileTile * 0.56),
            stroke: 'bg',
            enter: 'none',
          } satisfies CanvasElement,
          text(
            'FILE',
            file.x + 14 + fileTile + 22,
            fcy + s.chipFs * 0.36,
            s.chipFs,
            'semibold',
            'bg',
            { fit: file.w - fileTile - 36 - 22 - 64 },
          ),
          clipIcon(file.x + file.w - round(36 * k), fcy, 'bg'),
          {
            type: 'rect',
            x: file.x + 16,
            y: file.y + file.h - round(14 * k),
            w: file.w - 32,
            h: round(6 * k),
            r: round(3 * k),
            fill: 'bg',
            opacity: 0.85,
            enter: 'none',
            origin: [file.x + 16, file.y + file.h - round(11 * k)],
            keys: [
              { at: 0, dur: 0, scaleX: 0 },
              cued('LINK', 0, { dur: 0.45, ease: 'inOut', scaleX: 1 }),
            ],
          } satisfies CanvasElement,
        ],
      } satisfies CanvasElement,
    ],
  } satisfies CanvasElement);
  return { ...context, cued, text, k, s, centre, ui };
}
