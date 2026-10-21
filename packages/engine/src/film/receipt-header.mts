import type { ReceiptScene } from './receipt-contracts.mjs';

export function receiptHeader(scene: ReceiptScene): void {
  const { at, fail, s, merchant, detail, id, w, els, text } = scene;
  let { cy, sum } = scene;
  els.push(
    text(merchant.toUpperCase(), w / 2, cy, s * 1.9, 'poster', 'ink', {
      anchor: 'middle',
      id: `${id}-merchant`,
    }),
  );
  if (detail != null) {
    if (typeof detail !== 'string' || detail.length > 40)
      fail(
        `${at}.detail must be one short line (an address, a date), up to 40 characters`,
      );
    cy += s * 1.6;
    els.push(
      text(detail, w / 2, cy, s * 0.8, 'mono', 'muted', {
        anchor: 'middle',
        id: `${id}-detail`,
      }),
    );
  }

  scene.cy = cy;
  scene.sum = sum;
}
