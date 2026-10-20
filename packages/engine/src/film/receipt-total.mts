import type { ReceiptScene } from './receipt-contracts.mjs';
import { money } from './receipt-common.mjs';
export function receiptTotal(scene: ReceiptScene): void {
  const { at, fail, s, paid, footer, currency, id, w, pad, els, text, rule } =
    scene;
  let { cy, sum } = scene;
  cy += s * 0.95;
  els.push(rule(cy));
  cy += s * 1.75;
  els.push({
    type: 'group',
    id: `${id}-total`,
    children: [
      text('TOTAL', pad, cy, s * 1.15, 'mono', 'ink'),
      text(money(sum, currency), w - pad, cy, s * 1.15, 'mono', 'ink', {
        anchor: 'end',
      }),
    ],
  });
  if (paid != null) {
    if (typeof paid !== 'string' || paid.length > 32)
      fail(`${at}.paid must be one short line (e.g. "Visa •••• 4417")`);
    cy += s * 1.4;
    els.push(
      text(paid, pad, cy, s * 0.8, 'mono', 'muted', { id: `${id}-paid` }),
    );
  }
  if (footer != null) {
    if (typeof footer !== 'string' || footer.length > 32)
      fail(`${at}.footer must be one short line (e.g. "Example")`);
    cy += s * 1.6;
    els.push(
      text(footer, w / 2, cy, s * 0.95, 'hand', 'muted', {
        anchor: 'middle',
        id: `${id}-footer`,
      }),
    );
  }

  scene.cy = cy;
  scene.sum = sum;
}
