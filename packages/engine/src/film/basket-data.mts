// Fixed-composition price snapshots. Counts and minor-currency arithmetic are
// exact integers; index/percentage values retain their defining rational pair.
import { utcDay } from './plot-data.mjs';
import {
  keys,
  dense,
  integer,
  words as validateWords,
  required,
} from './financial/validation.mjs';
import type {
  Currency,
  BasketInput,
  BasketItem,
  BasketInputPeriod,
  BasketRow,
  PricedBasketRow,
  BasketPeriod,
  CompletePeriod,
} from './financial/basket-types.mjs';
export type * from './financial/basket-types.mjs';
export const BASKET_VERSION = 1;
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`basket: ${message}`);
}
const own = (o: unknown, allowed: readonly string[], label: string) =>
  keys(o, allowed, label, 'basket');
const words = (s: unknown, n: number, label: string) =>
  validateWords(s, n, label, 'basket');
const exact = (n: bigint, label: string) => {
  check(
    n >= 0n && n <= BigInt(Number.MAX_SAFE_INTEGER),
    `${label} exceeds safe minor-unit range`,
  );
  return Number(n);
};
export function basketAmount(minor: number, currency: Currency) {
  own(currency, ['unit', 'decimals'], 'currency');
  words(currency.unit, 8, 'currency.unit');
  check(integer(currency.decimals, 0, 6), 'currency.decimals must be 0–6');
  check(integer(minor, 0), 'amount must be nonnegative safe minor units');
  const n = BigInt(minor),
    scale = 10n ** BigInt(currency.decimals),
    fraction = currency.decimals
      ? '.' + String(n % scale).padStart(currency.decimals, '0')
      : '';
  return `${n / scale}${fraction} ${currency.unit}`;
}
function basketItems(input: BasketInput): BasketItem[] {
  check(
    dense(input.items) && input.items.length >= 1 && input.items.length <= 24,
    'items must contain 1–24 explicit entries',
  );
  const items = input.items.map((v, i) => {
    own(v, ['id', 'label', 'unit', 'quantity'], `items[${i}]`);
    check(
      typeof v.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(v.id),
      'item id required',
    );
    words(v.label, 32, 'item label');
    words(v.unit, 24, 'item unit');
    check(
      integer(v.quantity, 1, 1_000_000),
      'quantity must be a whole number from 1 to 1000000',
    );
    return { ...v };
  });
  check(
    new Set(items.map((v) => v.id)).size === items.length,
    'item ids must be unique',
  );
  check(
    new Set(items.map((v) => v.label.trim().replace(/\s+/g, ' '))).size ===
      items.length,
    'item labels must be distinct',
  );
  return items;
}
function priceRow(
  item: BasketItem,
  prices: BasketInputPeriod['pricesMinor'],
): BasketRow {
  check(
    Object.hasOwn(prices, item.id),
    `missing price key ${item.id}; use explicit null for an unknown price`,
  );
  const price = prices[item.id];
  check(
    price === null || integer(price, 0),
    'unit prices must be nonnegative safe minor units or explicit null',
  );
  return {
    ...item,
    unitPriceMinor: price,
    lineCostMinor:
      price === null
        ? null
        : exact(BigInt(item.quantity) * BigInt(price), 'line cost'),
  };
}
function pricedRow(row: BasketRow): PricedBasketRow {
  check(
    row.unitPriceMinor !== null && row.lineCostMinor !== null,
    'complete snapshot has an unpriced row',
  );
  return {
    ...row,
    unitPriceMinor: row.unitPriceMinor,
    lineCostMinor: row.lineCostMinor,
  };
}
function snapshot(
  p: BasketInputPeriod,
  items: BasketItem[],
  budgetMinor: number,
): BasketPeriod {
  own(
    p.pricesMinor,
    items.map((v) => v.id),
    'pricesMinor',
  );
  const rows = items.map((item) => priceRow(item, p.pricesMinor));
  const missing = rows
      .filter((v) => v.unitPriceMinor === null)
      .map((v) => v.id),
    subtotal = exact(
      rows.reduce((s, v) => s + BigInt(v.lineCostMinor ?? 0), 0n),
      'known subtotal',
    );
  const common = {
    date: p.date,
    missingItemIds: missing,
    coveredItems: items.length - missing.length,
    knownSubtotalMinor: subtotal,
  };
  if (missing.length)
    return {
      ...common,
      complete: false,
      rows,
      costMinor: null,
      wholeBaskets: null,
      remainderMinor: null,
      spentMinor: null,
    };
  check(subtotal > 0, 'a completely priced basket must have positive cost');
  const budget = BigInt(budgetMinor),
    cost = BigInt(subtotal),
    whole = budget / cost;
  return {
    ...common,
    complete: true,
    rows: rows.map(pricedRow),
    costMinor: subtotal,
    wholeBaskets: exact(whole, 'whole basket count'),
    spentMinor: exact(whole * cost, 'spent amount'),
    remainderMinor: exact(budget % cost, 'remainder'),
  };
}
function compareRow<R extends BasketRow>(row: R, base: CompletePeriod) {
  const b = required(
    base.rows.find((v) => v.id === row.id),
    'basket: missing base item',
  );
  return {
    ...row,
    baseCostWeight: { numerator: b.lineCostMinor, denominator: base.costMinor },
    unitChangeMinor:
      row.unitPriceMinor === null
        ? null
        : row.unitPriceMinor - b.unitPriceMinor,
    lineChangeMinor:
      row.lineCostMinor === null ? null : row.lineCostMinor - b.lineCostMinor,
  };
}
function comparePeriod(p: BasketPeriod, base: CompletePeriod) {
  if (!p.complete)
    return {
      ...p,
      rows: p.rows.map((row) => compareRow(row, base)),
      costIndex: null,
      changeMinor: null,
      changeFraction: null,
    };
  const changeMinor = p.costMinor - base.costMinor;
  return {
    ...p,
    rows: p.rows.map((row) => compareRow(row, base)),
    costIndex: {
      numerator: p.costMinor,
      denominator: base.costMinor,
      base: 100,
      value: (p.costMinor / base.costMinor) * 100,
    },
    changeMinor,
    changeFraction: { numerator: changeMinor, denominator: base.costMinor },
  };
}
export function fixedBasket(input: BasketInput) {
  own(
    input,
    [
      'title',
      'source',
      'asOf',
      'baseDate',
      'currency',
      'budgetMinor',
      'substitutionPolicy',
      'priceBasis',
      'qualification',
      'items',
      'periods',
    ],
    'input',
  );
  words(input.title, 72, 'title');
  words(input.source, 90, 'source');
  words(input.priceBasis, 110, 'priceBasis');
  words(input.qualification, 120, 'qualification');
  utcDay(input.asOf);
  utcDay(input.baseDate);
  check(
    input.substitutionPolicy === 'none',
    'only substitutionPolicy "none" is supported',
  );
  check(
    integer(input.budgetMinor, 0),
    'budgetMinor must be nonnegative safe minor units',
  );
  basketAmount(input.budgetMinor, input.currency);
  const items = basketItems(input);
  check(
    dense(input.periods) &&
      input.periods.length >= 2 &&
      input.periods.length <= 120,
    'periods must contain 2–120 explicit snapshots',
  );
  let previous = -Infinity;
  const snapshots = input.periods.map((p, i) => {
    own(p, ['date', 'pricesMinor'], `periods[${i}]`);
    const day = utcDay(p.date);
    check(day > previous, 'price dates must strictly increase');
    previous = day;
    return snapshot(p, items, input.budgetMinor);
  });
  const base = snapshots.find((v) => v.date === input.baseDate);
  check(
    base?.complete,
    'baseDate must identify a complete, positive-cost snapshot',
  );
  const periods = snapshots.map((p) => comparePeriod(p, base));
  return {
    version: BASKET_VERSION,
    title: input.title,
    source: input.source,
    asOf: input.asOf,
    baseDate: input.baseDate,
    currency: { ...input.currency },
    budgetMinor: input.budgetMinor,
    substitutionPolicy: 'none',
    priceBasis: input.priceBasis,
    qualification: input.qualification,
    items,
    periods,
    meaning:
      'The same quantities and units at each supplied date. No substitution, quality adjustment, interpolation, taxes or extra charges are inferred. Incomplete snapshots have no basket total, index or purchasing count.',
  };
}
