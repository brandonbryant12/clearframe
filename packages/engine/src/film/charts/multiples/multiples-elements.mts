import { axisPosition, type AxisValue } from '../../plot-data.mjs';
import { plotLayout, titleText, titleShift } from '../../plots.mjs';
import type { CanvasElement, ElementFields, FrameSize } from '../../types.mjs';
import type { MultiplesSpec } from './contracts.mjs';
import { show } from './primitives.mjs';
import { panelColumns } from './panel-columns.mjs';
import { check } from './check.mjs';
import { drawMultiplePanel } from './draw-multiple-panel.mjs';

export function multiplesElements(
  p: MultiplesSpec,
  frame: FrameSize,
): CanvasElement[] {
  const { width } = frame,
    L = plotLayout(frame),
    tall = L.orientation !== 'landscape',
    n = p.panels.length;
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin);
  title.id = 'multiples-title';
  const elements: CanvasElement[] = [
    title,
    {
      id: 'multiples-unit',
      type: 'text',
      text: p.unit + (p.y.type === 'log' ? ' · log scale' : ''),
      x: L.margin,
      y: L.keyY + shift,
      size: L.keyType,
      fill: 'muted',
      font: 'semibold',
      fit: width - 2 * L.margin,
      ...show,
    },
  ];
  const cols = panelColumns(tall, n),
    rows = Math.ceil(n / cols);
  const font = L.type,
    gridTop = L.top + shift - font * 0.6,
    gridBottom = L.bottom + font * 0.8;
  const tickW = width * (tall ? 0.085 : 0.045),
    gapX = width * (tall ? 0.05 : 0.03),
    gapY = font * 3.4;
  const panelW =
      (width - 2 * L.margin - font * 0.6 - tickW - gapX * (cols - 1)) / cols,
    panelH = (gridBottom - gridTop - gapY * (rows - 1) - font * 1.6) / rows;
  check(
    panelH >= font * 4 && panelW >= font * 6,
    'too many panels for this frame; use fewer series',
  );
  const motion = p.motion;
  const end = motion === 'none' ? 0 : motion.at + motion.duration;
  const time = (x: AxisValue): number =>
    motion === 'none' ? 0 : motion.at + motion.duration * axisPosition(x, p.x);
  const arrive = (at: number): ElementFields =>
    at === 0 ? show : { at, enter: 'fade', dur: 0.3 };
  const stroke = width * (tall ? 0.006 : 0.0032);
  const yEnds = [p.y.ticks[0], p.y.ticks[p.y.ticks.length - 1]],
    xEnds = [p.x.ticks[0], p.x.ticks[p.x.ticks.length - 1]];
  for (const [k, panel] of p.panels.entries()) {
    drawMultiplePanel({
      panel,
      k,
      cols,
      L,
      tickW,
      panelW,
      gapX,
      gridTop,
      font,
      panelH,
      gapY,
      p,
      yEnds,
      elements,
      rows,
      n,
      xEnds,
      stroke,
      motion,
      time,
      arrive,
      end,
    });
  }
  return elements;
}
