import type { Card } from '../scene-types.mjs';
import type { allocationPlan } from '../../allocation-data.mjs';
import { allocationAmount } from '../../allocation-data.mjs';

import { check } from './check.mjs';

export function layoutAllocationCards({
  n,
  tall,
  w,
  h,
  columns,
  size,
  gap,
  font,
  model,
  small,
  cards,
}: LayoutAllocationCardsContext) {
  for (let i = 0; i < n; i++) {
    const x = tall
        ? w * 0.115
        : w * 0.09 + i * ((w * 0.82) / n + (w * 0.035) / n),
      y = tall ? h * 0.29 + (i * h * 0.48) / n : h * 0.3;
    const width = tall ? w * 0.65 : (w * 0.82 - w * 0.035 * (n - 1)) / n,
      height = tall ? (h * 0.48) / n - h * 0.045 : h * 0.37;
    const gridWidth = columns * size + (columns - 1) * gap,
      gridX = x + (width - gridWidth) / 2,
      gridY = y + font * 3.1;
    check(gridX >= x + 12, 'tray columns do not fit');
    const rows = Math.ceil(model.capacity[i] / columns);
    check(
      gridY + Math.max(0, rows * size + (rows - 1) * gap) <= y + height - 8,
      'tray capacity does not fit this format',
    );
    check(
      model.buckets[i].label.length * font * 0.62 < width - 24,
      'tray label too long',
    );
    const maxText = `${model.capacity[i]} tiles · ${allocationAmount(model.capacity[i] * model.quantum.minorUnits, model.quantum)}`;
    check(
      maxText.length * small * 0.6 < width - 24,
      'tray amount label too long; change the declared unit or layout',
    );
    cards.push({
      id: model.buckets[i].id,
      index: i,
      x,
      y,
      width,
      height,
      gridX,
      gridY,
      columns,
      corridorY: tall
        ? y + height + h * 0.0225 - size / 2
        : h * 0.725 - size / 2,
    });
  }
}

export interface LayoutAllocationCardsContext {
  n: number;
  tall: boolean;
  w: number;
  h: number;
  columns: number;
  size: number;
  gap: number;
  font: number;
  model: ReturnType<typeof allocationPlan>;
  small: number;
  cards: Card[];
}
