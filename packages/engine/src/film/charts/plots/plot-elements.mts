import {
  axisPosition,
  axisLabel,
  type AxisValue,
  type ObservedPoint,
  type PlotSeries,
  type PlotSpec,
} from '../../plot-data.mjs';
import type { CanvasElement, ElementFields, FrameSize } from '../../types.mjs';
import { plotLayout } from './plot-layout.mjs';
import { titleShift, show, text } from './primitives.mjs';
import { check } from './check.mjs';
import { checkSpacing } from './check-spacing.mjs';
import { titleText } from './title-text.mjs';
import { plotLegend } from './plot-legend.mjs';
import { plotBands } from './plot-bands.mjs';
import { plotAxes } from './plot-axes.mjs';
import { drawPlotSeries } from './draw-plot-series.mjs';
import { endLabelPositions } from './end-label-positions.mjs';
import { plotAnnotation } from './plot-annotation.mjs';

export function plotElements(p: PlotSpec, frame: FrameSize): CanvasElement[] {
  const { width } = frame,
    L = plotLayout(frame, { xLabel: p.x.type !== 'date' }),
    { u, left, right, bottom } = L;
  // Extra key rows and a wrapped title push the plot down instead of crowding the unit label.
  const keyRows = Math.ceil(
    p.series.length / (L.orientation === 'landscape' ? p.series.length : 2),
  );
  const top =
    L.top +
    (keyRows - 1) * L.keyType * 1.6 +
    titleShift(p.title, L, width - 2 * L.margin);
  check(
    bottom - top >= (bottom - L.top) * 0.7,
    'too many series or too long a title for this frame',
  );
  const px = (x: AxisValue): number =>
    left + axisPosition(x, p.x) * (right - left);
  const py = (y: AxisValue): number =>
    bottom - axisPosition(y, p.y) * (bottom - top);
  checkSpacing(p, L, px, py);
  const motion = p.motion;
  const time = (x: AxisValue): number =>
    motion === 'none' ? 0 : motion.at + motion.duration * axisPosition(x, p.x);
  const end = motion === 'none' ? 0 : motion.at + motion.duration;
  const begin = motion === 'none' ? 0 : motion.at;
  const arrive = (at: number): ElementFields =>
    at === 0 ? show : { at, enter: 'fade', dur: 0.35 };
  const font = L.type,
    contentWidth = width - 2 * L.margin;
  const elements: CanvasElement[] = [
    titleText(p.title, L, contentWidth),
    text(
      'plot-unit',
      p.y.label + (p.y.type === 'log' ? ' · log scale' : ''),
      left,
      top - font * 1.1,
      font,
      { fill: 'muted', fit: right - left },
    ),
  ];
  if (p.x.type !== 'date')
    elements.push(
      text(
        'plot-x-label',
        p.x.label,
        (left + right) / 2,
        bottom + font * 3.3,
        font,
        { anchor: 'middle', fill: 'muted', fit: right - left },
      ),
    );
  // Key: one row in landscape, two columns otherwise. Labels only; values appear at the line ends.
  plotLegend(L, p, contentWidth, elements);
  // Regime bands (recessions, policy cycles) sit under the grid and fade in before the line draws.
  plotBands({ p, px, elements, top, bottom, arrive, begin, right, font });
  plotAxes({ p, elements, left, py, right, font, L, px, bottom });
  const strokeWidth = u * (L.orientation === 'landscape' ? 0.0042 : 0.0062);
  const terminals: {
    s: PlotSeries;
    color: string;
    terminal: ObservedPoint;
    x: number;
    y: number;
    labelled: boolean;
  }[] = [];
  for (const [seriesIndex, s] of p.series.entries()) {
    drawPlotSeries({
      seriesIndex,
      s,
      p,
      elements,
      px,
      bottom,
      py,
      arrive,
      end,
      time,
      strokeWidth,
      motion,
      terminals,
    });
  }
  const valueType = font * 1.2;
  // Values label the line ends at the right edge; a series that stops earlier (history before a projection) keeps only its end dot.
  const labelled = terminals.filter((t) => t.labelled);
  const placed = endLabelPositions(
    labelled.map((t) => t.y),
    valueType * 1.25,
    top,
    bottom,
  );
  for (const t of terminals)
    elements.push({
      id: `plot-${t.s.id}-end`,
      type: 'circle',
      cx: t.x,
      cy: t.y,
      r: strokeWidth * 1.9,
      fill: t.color,
      ...arrive(time(t.terminal.x)),
    });
  for (const [i, t] of labelled.entries())
    elements.push(
      text(
        `plot-${t.s.id}-value`,
        axisLabel(t.terminal.y, p.y),
        right + font * 0.9,
        placed[i] + valueType * 0.36,
        valueType,
        {
          font: 'figures',
          fill: t.color,
          fit: width - L.margin - right - font,
          ...arrive(time(t.terminal.x)),
        },
      ),
    );
  plotAnnotation({
    p,
    px,
    py,
    right,
    left,
    bottom,
    top,
    u,
    arrive,
    time,
    begin,
    elements,
    font,
    strokeWidth,
  });
  return elements;
}
