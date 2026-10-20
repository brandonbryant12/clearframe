import type { ReceiptScene } from './receipt-contracts.mjs';
import { money } from './receipt-common.mjs';
export function receiptItems(scene: ReceiptScene): void {
  const {
    at,
    fail,
    s,
    items,
    tax,
    tip,
    total,
    lines,
    currency,
    id,
    w,
    pad,
    els,
    text,
    rule,
    mono,
  } = scene;
  let { cy, sum } = scene;

  if (lines != null) fail(`${at}.lines belongs to a card slip (slip: true)`);
  if (!Array.isArray(items) || items.length < 1 || items.length > 8)
    fail(
      `${at}.items must be 1–8 lines: {qty, name, price} with price the line's amount`,
    );
  cy += s * 0.9;
  els.push(rule(cy));
  cy += s * 0.4;
  const qtyW = items.some((it) => it.qty != null)
    ? Math.max(...items.map((it) => mono(it.qty ?? ''))) + s * 0.9
    : 0;
  const priceW = Math.max(
    ...items.map((it) => mono(money(it.price ?? 0, currency))),
  );
  items.forEach((it, i) => {
    const where = `${at}.items[${i}]`;
    if (
      !it ||
      typeof it !== 'object' ||
      typeof it.name !== 'string' ||
      !it.name.trim()
    )
      fail(`${where} needs a name`);
    if (!Number.isFinite(it.price))
      fail(`${where}.price must be the line's amount (a number)`);
    if (
      it.qty != null &&
      !(Number.isInteger(it.qty) && it.qty > 0 && it.qty < 1000)
    )
      fail(`${where}.qty must be a whole number`);
    for (const key of Object.keys(it))
      if (!['qty', 'name', 'price'].includes(key))
        fail(`${where}: unsupported field ${key}`);
    if (mono(it.name) > w - pad * 2 - qtyW - priceW - s)
      fail(
        `${where}.name "${it.name}" is too long for the receipt's width: shorten it or widen the receipt (w)`,
      );
    cy += s * 1.55;
    els.push({
      type: 'group',
      id: `${id}-item-${i + 1}`,
      children: [
        ...(it.qty != null
          ? [text(String(it.qty), pad, cy, s, 'mono', 'ink')]
          : []),
        text(it.name, pad + qtyW, cy, s, 'mono', 'ink'),
        text(money(it.price, currency), w - pad, cy, s, 'mono', 'ink', {
          anchor: 'end',
        }),
      ],
    });
    sum += it.price;
  });
  const extras: [string, string, number | undefined][] = [
    ['tax', 'Tax', tax],
    ['tip', 'Tip', tip],
  ];
  for (const [key, label, value] of extras) {
    if (value == null) continue;
    if (!Number.isFinite(value)) fail(`${at}.${key} must be an amount`);
    cy += s * 1.45;
    els.push({
      type: 'group',
      id: `${id}-${key}`,
      children: [
        text(label, pad + qtyW, cy, s, 'mono', 'muted'),
        text(money(value, currency), w - pad, cy, s, 'mono', 'muted', {
          anchor: 'end',
        }),
      ],
    });
    sum += value;
  }
  // The total is the sum of the lines: a receipt on screen that does not add up is a wrong figure.
  if (
    total != null &&
    (!Number.isFinite(total) || Math.abs(total - sum) > 0.005)
  )
    fail(
      `${at}.total is ${total}, but the items${tax != null ? ', tax' : ''}${tip != null ? ' and tip' : ''} add up to ${money(sum, currency)}: correct a line or the total`,
    );

  scene.cy = cy;
  scene.sum = sum;
}
