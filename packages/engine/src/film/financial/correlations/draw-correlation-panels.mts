import type {
  CorrelationCell,
  correlationMatrix,
} from '../../correlation-data.mjs';
import type { AxisValue, PlotSpec } from '../../plot-data.mjs';
import type {
  CorrelationGeometry,
  PreviousCorrelationPoint,
} from '../scene-types.mjs';
import { axisPosition } from '../../plot-data.mjs';
import { show, text } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { drawCorrelationPanelTicks } from './draw-correlation-panel-ticks.mjs';
import { drawCorrelationObservations } from './draw-correlation-observations.mjs';

export function drawCorrelationPanels({
  selectedPair,
  p,
  margin,
  tall,
  pw,
  gap,
  top,
  ph,
  local,
  xAxis,
  id,
  size,
  model,
  reveal,
  cell,
  geometry,
  w,
  elements,
}: DrawCorrelationPanelsContext) {
  for (const [i, sid] of selectedPair.entries()) {
    const s = required(
        p.series.find((s) => s.id === sid),
        'correlation scene: missing series observation',
      ),
      x = margin + (tall ? 0 : i * (pw + gap)),
      y = top + (tall ? i * (ph + gap) : 0),
      color = i === 0 ? 'accent' : 'accent2',
      px = (d: AxisValue) =>
        local.left + axisPosition(d, xAxis) * (local.right - local.left),
      py = (v: AxisValue) =>
        local.bottom - axisPosition(v, p.y) * (local.bottom - local.top),
      children = [
        text(`${id}-${sid}-name`, s.label, 0, size, size, {
          font: 'semibold',
        }),
      ];
    drawCorrelationPanelTicks({
      p,
      children,
      id,
      sid,
      local,
      py,
      size,
      xAxis,
      px,
    });
    const markers: CanvasElement[] = [];
    let prev: PreviousCorrelationPoint | null = null;
    prev = drawCorrelationObservations({
      model,
      s,
      reveal,
      xAxis,
      cell,
      prev,
      geometry,
      sid,
      id,
      px,
      py,
      color,
      w,
      children,
      x,
      y,
      markers,
    });
    // Draw every marker after both adjacent segments. A hollow observation must
    // mask the later segment as well as the earlier one throughout the reveal.
    children.push(...markers);
    elements.push({
      id: `${id}-${sid}-panel`,
      type: 'group',
      x,
      y,
      children,
      ...show,
    });
  }
}

export interface DrawCorrelationPanelsContext {
  selectedPair: [string, string];
  p: PlotSpec;
  margin: number;
  tall: boolean;
  pw: number;
  gap: number;
  top: number;
  ph: number;
  local: { left: number; right: number; top: number; bottom: number };
  xAxis: {
    domain: string[];
    ticks: string[];
    type: 'linear' | 'date' | 'log';
    label: string;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    dateFormat?: string;
  };
  id: string;
  size: number;
  model: ReturnType<typeof correlationMatrix>;
  reveal: boolean;
  cell: CorrelationCell;
  geometry: CorrelationGeometry;
  w: number;
  elements: CanvasElement[];
}
