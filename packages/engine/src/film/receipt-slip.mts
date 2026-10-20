import { finite } from './guards.mjs';

import type { ReceiptScene } from './receipt-contracts.mjs';

export function receiptSlip(scene: ReceiptScene): void {
  const { at, fail, s, items, total, lines, id, w, els, text } = scene;
  let { cy, sum } = scene;

  if (items.length)
    fail(
      `${at}: a card slip prints no items (that is what makes it not a receipt); drop slip for an itemised receipt`,
    );
  const printed = lines ?? ['CARD PAYMENT', 'APPROVED'];
  if (
    !Array.isArray(printed) ||
    printed.length > 4 ||
    printed.some((l) => typeof l !== 'string' || l.length > 24)
  )
    fail(`${at}.lines must be up to four short printed lines`);
  cy += s * 0.6;
  printed.forEach((l, i) => {
    cy += s * 1.4;
    els.push(
      text(l, w / 2, cy, s * 0.85, 'mono', i ? 'muted' : 'ink', {
        anchor: 'middle',
        id: `${id}-line-${i + 1}`,
      }),
    );
  });
  if (!finite(total))
    return fail(`${at}.total must be the amount the slip prints`);
  sum = total;

  scene.cy = cy;
  scene.sum = sum;
}
