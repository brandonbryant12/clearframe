import type { correlationMatrix } from '../../correlation-data.mjs';

import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawCorrelationHeader({
  elements,
  id,
  heading,
  margin,
  h,
  tall,
  w,
  model,
}: DrawCorrelationHeaderContext) {
  elements.push(
    text(
      id + '-title',
      heading,
      margin,
      h * (tall ? 0.09 : 0.115),
      w * (tall ? 0.047 : 0.034),
      { font: 'display', width: w - 2 * margin, height: h * 0.08 },
    ),
    text(
      id + '-window',
      `${model.window.start} to ${model.window.end}`,
      margin,
      h * (tall ? 0.155 : 0.19),
      w * (tall ? 0.032 : 0.025),
      { font: 'figures', fit: w - 2 * margin },
    ),
    text(
      id + '-method',
      `Pearson r · monthly returns · minimum ${model.minObservations} pairs`,
      margin,
      h * (tall ? 0.2 : 0.255),
      w * (tall ? 0.029 : 0.021),
      { fit: w - 2 * margin },
    ),
  );
}

export interface DrawCorrelationHeaderContext {
  elements: CanvasElement[];
  id: string;
  heading: string;
  margin: number;
  h: number;
  tall: boolean;
  w: number;
  model: ReturnType<typeof correlationMatrix>;
}
