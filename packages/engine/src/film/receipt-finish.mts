import type { CanvasElement } from './types.mjs';
import type { ReceiptScene } from './receipt-contracts.mjs';

export function receiptFinish(
  scene: ReceiptScene,
  paper: CanvasElement,
): CanvasElement {
  const { rest, id, x, y, els } = scene;
  // The receipt enters as one piece: its parts wait for the group.
  const still = (list: CanvasElement[]): CanvasElement[] =>
    list.map((el) => ({
      ...el,
      enter: 'none',
      ...(el.children ? { children: still(el.children) } : {}),
    }));
  return { type: 'group', ...rest, id, x, y, children: still([paper, ...els]) };
}
