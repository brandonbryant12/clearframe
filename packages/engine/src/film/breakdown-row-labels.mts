import type {
  BreakdownSpec,
  BreakdownLayout,
  BreakdownKind,
  BreakdownRow,
} from './breakdown-contracts.mjs';
export function rowLabel(
  G: BreakdownLayout,
  label: string,
  kind: BreakdownKind,
  cy: number,
  y: number,
): BreakdownRow['label'] {
  const header = kind === 'header' || kind === 'total';
  const base = {
    type: 'text' as const,
    text: label,
    size: G.font,
    font: header ? 'strong' : 'semibold',
    fill: kind === 'residual' ? 'muted' : 'ink',
  };
  if (G.beside)
    return {
      ...base,
      x: G.left - G.font * 0.6,
      y: cy + G.font * 0.35,
      anchor: 'end',
      fit: G.labelW,
    };
  if (G.lines(label) > 1)
    return {
      ...base,
      x: G.left,
      y: y - G.font * 1.55,
      anchor: 'start',
      width: G.room,
      leading: 1.1,
    };
  return {
    ...base,
    x: G.left,
    y: y - G.font * 0.45,
    anchor: 'start',
    fit: G.room,
  };
}
export function rowValue(
  p: BreakdownSpec,
  G: BreakdownLayout,
  value: number,
  kind: BreakdownKind,
  cy: number,
  y: number,
  bw: number,
): BreakdownRow['value'] {
  const base = {
    type: 'text' as const,
    text: p.format(value),
    size: G.font,
    font: 'figures',
    fill: kind === 'residual' ? 'muted' : 'ink',
  };
  if (G.beside)
    return {
      ...base,
      x: G.left + bw + (bw < 4 ? G.thickness * 0.16 + 12 : 0) + G.font * 0.5,
      y: cy + G.font * 0.35,
      anchor: 'start',
      fit: G.W - G.L.margin - (G.left + bw) - G.font * 0.5,
    };
  return {
    ...base,
    x: G.right,
    y: y - G.font * 0.45,
    anchor: 'end',
    fit: (G.right - G.left) * 0.34,
  };
}
