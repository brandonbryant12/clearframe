import { type RankedPanel } from './multiple-data.mjs';
import { axisPosition, type AxisValue } from './plot-data.mjs';
import type { CanvasElement } from './types.mjs';
import type { MultipleContext } from './multiple-scene-contracts.mjs';
import { rankLabel } from './multiple-scene-common.mjs';

export function multiplePanelContext(
  ctx: MultipleContext,
  s: RankedPanel,
  i: number,
) {
  const { id, p, L, local } = ctx;
  const box = L.boxes[i],
    children: CanvasElement[] = [],
    prefix = `${id}-${s.id}`,
    px = (x: AxisValue): number =>
      local.left + axisPosition(x, p.x) * (local.right - local.left),
    py = (y: AxisValue): number =>
      local.bottom - axisPosition(y, p.y) * (local.bottom - local.top);
  const rank = rankText(s),
    value = s.value === null ? 'Missing' : rankLabel(s.value, p.y);
  return { ctx, s, i, box, children, prefix, px, py, rank, value };
}
function rankText(s: RankedPanel): string {
  if (s.rank === null) return '—';
  return `${s.rank}${s.tied ? '=' : ''}`;
}
