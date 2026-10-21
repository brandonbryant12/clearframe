import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { inspectButton } from './button.mjs';

export function inspectToolbar(context: ReturnType<typeof inspectButton>) {
  const {
    report,
    choices,
    pad,
    cw,
    bar,
    card,
    STEP,
    cued,
    btn,
    btnC,
    btnFace,
    chrome,
    binEls,
  } = context;

  const toolbar = report
    ? [
        {
          type: 'rect',
          x: card.x + 1,
          y: card.y + 1,
          w: cw - 2,
          h: bar - 1,
          r: 27,
          fill: 'bg',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'rect',
          x: card.x + 1,
          y: card.y + bar - 28,
          w: cw - 2,
          h: 28,
          fill: 'bg',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'line',
          x1: card.x,
          y1: card.y + bar,
          x2: card.x + cw,
          y2: card.y + bar,
          stroke: 'line',
          width: 2,
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'path',
          d: `M ${round(card.x + pad + chrome * 0.3)} ${round(card.y + bar / 2 - chrome * 0.5)} L ${round(card.x + pad - chrome * 0.25)} ${round(card.y + bar / 2)} L ${round(card.x + pad + chrome * 0.3)} ${round(card.y + bar / 2 + chrome * 0.5)}`,
          fill: 'none',
          stroke: 'muted',
          width: 3,
          cap: 'round',
          join: 'round',
          enter: 'none',
        } satisfies CanvasElement,
        ...['folder', 'mail'].map(
          (name, i) =>
            ({
              type: 'icon',
              name,
              x: round(card.x + pad + chrome * (2.4 + 1.9 * i)),
              y: round(card.y + bar / 2),
              size: chrome,
              stroke: 'muted',
              enter: 'none',
            }) satisfies CanvasElement,
        ),
        ...(choices ? binEls() : []),
        {
          type: 'group',
          enter: 'none',
          origin: btnC,
          keys: [
            cued(STEP.light, { dur: 0.3, ease: 'thereAndBack', scale: 0.92 }),
          ],
          children: [
            {
              type: 'rect',
              ...btn,
              r: round(btn.h / 2),
              fill: 'surface',
              stroke: 'line',
              width: 2,
              enter: 'none',
            } satisfies CanvasElement,
            ...btnFace('ink', 'positive'),
            {
              type: 'group',
              enter: 'fade',
              dur: 0.2,
              ...cued(STEP.light),
              children: [
                {
                  type: 'rect',
                  ...btn,
                  r: round(btn.h / 2),
                  fill: 'positive',
                  enter: 'none',
                  glow: { blur: 26, opacity: 0.45 },
                } satisfies CanvasElement,
                ...btnFace('bg', 'bg'),
              ],
            } satisfies CanvasElement,
          ],
        } satisfies CanvasElement,
      ]
    : [];
  return {
    ...context,
    report,
    choices,
    pad,
    cw,
    bar,
    card,
    STEP,
    cued,
    btn,
    btnC,
    toolbar,
  };
}
