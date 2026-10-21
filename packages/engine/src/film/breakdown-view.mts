import { partAt, childrenOf } from './breakdown-common.mjs';
import { rowLabel, rowValue } from './breakdown-row-labels.mjs';
import type {
  BreakdownSpec,
  BreakdownLayout,
  BreakdownRow,
  BreakdownKind,
} from './breakdown-contracts.mjs';
/** One view as rows, each bar exactly value / parent of the available width. */
export function view(
  p: BreakdownSpec,
  G: BreakdownLayout,
  parentKey: string | null,
): BreakdownRow[] {
  const parent = parentKey ? partAt(p, parentKey) : null;
  const items = parent ? childrenOf(parent) : p.parts;
  const scale = parent ? parent.value : p.total.value;
  const highlighted = items.some((x) => x.highlight);
  const row = (
    i: number,
    key: string[],
    label: string,
    value: number,
    kind: BreakdownKind,
  ): BreakdownRow => {
    const cy = G.top + G.slot * (i + 0.5) + (G.beside ? 0 : G.font * 0.55);
    const bw = (G.right - G.left) * (value / scale),
      y = cy - G.thickness / 2;
    return {
      key,
      kind,
      cy,
      amount: value,
      bar: { x: G.left, y, w: bw, h: G.thickness },
      marker:
        bw < 4
          ? {
              type: 'circle',
              cx: G.left + bw,
              cy,
              r: Math.max(6, G.thickness * 0.16),
              fill: 'none',
              width: 2,
            }
          : null,
      label: rowLabel(G, label, kind, cy, y),
      value: rowValue(p, G, value, kind, cy, y, bw),
    };
  };
  const out: BreakdownRow[] = [
    parent
      ? row(0, [parent.id], parent.label, parent.value, 'header')
      : row(0, ['total'], p.total.label, p.total.value, 'total'),
  ];
  items.forEach((x, i) =>
    out.push({
      ...row(
        i + 1,
        parent ? [parent.id, x.id] : [x.id],
        x.label,
        x.value,
        x.remainder ? 'residual' : 'part',
      ),
      item: x,
      fill: !highlighted || x.highlight ? 'accent' : 'muted',
    }),
  );
  return out;
}
