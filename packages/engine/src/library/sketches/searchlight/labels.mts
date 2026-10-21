import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT, LABELS } from './common.mjs';
import type { SearchlightContext } from './contracts.mjs';
export function searchlightLabels(
  context: SearchlightContext,
): CanvasElement[] {
  const { size, finds } = context;
  return [
    // Each find keeps its label once found, fading in as the light arrives.
    ...finds.flatMap((f, i) => [
      {
        type: 'rect',
        x: f.x - 160,
        y: f.b + 24,
        w: 320,
        h: size + 30,
        r: 10,
        fill: 'bg',
        opacity: 0.9,
        enter: 'fade',
        cue: LABELS[i],
        at: AT[LABELS[i]],
        dur: 0.8,
      } satisfies CanvasElement,
      {
        type: 'text',
        text: LABELS[i],
        x: f.x,
        y: f.b + 24 + round(size * 1.05),
        size,
        font: 'semibold',
        fill: 'ink',
        anchor: 'middle',
        fit: 296,
        enter: 'fade',
        cue: LABELS[i],
        at: AT[LABELS[i]],
        dur: 0.8,
      } satisfies CanvasElement,
    ]),
  ];
}
