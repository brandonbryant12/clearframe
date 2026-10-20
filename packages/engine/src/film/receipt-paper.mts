import type { CanvasElement } from './types.mjs';
import type { ReceiptScene } from './receipt-contracts.mjs';
import { round } from './receipt-common.mjs';
export function receiptPaper(scene: ReceiptScene): CanvasElement {
  const { s, shadow, rest, id, w, pad } = scene;
  let { cy } = scene;
  // The paper: square at the top, torn at the foot in an even zigzag.
  const h = cy + pad * 1.2;
  const tooth = Math.max(12, s * 0.7);
  const teeth = Math.max(4, Math.round(w / (tooth * 2)));
  const step = w / teeth;
  let d = `M 0 0 L ${round(w)} 0 L ${round(w)} ${round(h)}`;
  for (let i = teeth - 1; i >= 0; i--)
    d += ` L ${round(i * step + step / 2)} ${round(h + tooth * 0.6)} L ${round(i * step)} ${round(h)}`;
  d += ' Z';
  const paper: CanvasElement = {
    type: 'path',
    id: `${id}-paper`,
    d,
    fill: rest.fill ?? 'paper',
    stroke: 'none',
    ...(shadow ? { shadow: true } : {}),
  };
  delete rest.fill;

  return paper;
}
