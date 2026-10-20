import type { PhaseDrawingPoint } from '../scene-types.mjs';
import type { phaseTrail } from '../../phase-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { phaseValue } from './phase-value.mjs';
import { phaseState } from './phase-state.mjs';

export function drawPhaseSummary({
  h,
  tall,
  focus,
  m,
  copyWidth,
  view,
  elements,
  id,
  margin,
  small,
}: DrawPhaseSummaryContext) {
  const fy = h * (tall ? 0.865 : 0.835),
    selectedText = `${focus.date}: x ${phaseValue(focus.x, m.x.decimals)}, y ${phaseValue(focus.y, m.y.decimals)}`,
    state = phaseState(focus, m.quadrants),
    copyBox = tall
      ? { fit: copyWidth }
      : { width: copyWidth, height: h * 0.11 };
  if (view === 'focus')
    elements.push(
      text(
        id + '-focus-values',
        selectedText,
        margin,
        h * (tall ? 0.825 : 0.72),
        small,
        { font: 'figures', ...copyBox },
      ),
      text(id + '-focus-state', state, margin, fy, small, { ...copyBox }),
    );
  else
    elements.push(
      text(
        id + '-guide',
        'Dated observations; lines are guides only',
        margin,
        h * (tall ? 0.825 : 0.72),
        small,
        { ...copyBox },
      ),
      text(
        id + '-missing',
        `${m.observed} pairs · ${m.missing} missing · no smoothing or assumed cycle`,
        margin,
        fy,
        small,
        { ...copyBox },
      ),
    );
}

export interface DrawPhaseSummaryContext {
  h: number;
  tall: boolean;
  focus: PhaseDrawingPoint;
  m: ReturnType<typeof phaseTrail>;
  copyWidth: number;
  view: string;
  elements: CanvasElement[];
  id: string;
  margin: number;
  small: number;
}
