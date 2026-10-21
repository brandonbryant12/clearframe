import type { FrameSize } from '../../types.mjs';
import type { PlotLayout } from './contracts.mjs';
import { check } from './check.mjs';
import { plotOrientation } from './plot-orientation.mjs';

/** Frame geometry. Landscape keeps the plot in the middle half of the frame; vertical and square
 * frames stack title, key and plot. Every size is relative to the frame, never fixed pixels. */
export function plotLayout(
  { width, height }: FrameSize,
  { xLabel = false }: { xLabel?: boolean } = {},
): PlotLayout {
  check(
    Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 640 &&
      height >= 640,
    'frame must be at least 640×640',
  );
  const u = Math.min(width, height),
    aspect = width / height;
  const orientation = plotOrientation(aspect);
  const P = {
    landscape: {
      margin: 0.065,
      title: 0.034,
      titleY: 0.135,
      key: 0.0175,
      keyY: 0.215,
      type: 0.0145,
      top: 0.31,
      bottom: 0.77,
      yReserve: 0.052,
      endReserve: 0.115,
    },
    square: {
      margin: 0.1,
      title: 0.052,
      titleY: 0.13,
      key: 0.029,
      keyY: 0.215,
      type: 0.025,
      top: 0.32,
      bottom: 0.77,
      yReserve: 0.11,
      endReserve: 0.17,
    },
    vertical: {
      margin: 0.1,
      title: 0.062,
      titleY: 0.12,
      key: 0.034,
      keyY: 0.19,
      type: 0.029,
      top: 0.3,
      bottom: 0.78,
      yReserve: 0.125,
      endReserve: 0.19,
    },
  }[orientation];
  const margin = width * P.margin,
    type = Math.max(width * P.type, 20);
  const left = margin + width * P.yReserve,
    right = width - margin - width * P.endReserve;
  return {
    u,
    orientation,
    tall: orientation !== 'landscape',
    margin,
    type,
    keyType: width * P.key,
    titleType: width * P.title,
    titleY: height * P.titleY,
    keyY: height * P.keyY,
    left,
    right,
    top: height * P.top,
    bottom: height * (P.bottom - (xLabel ? 0.045 : 0)),
  };
}
