import type { CanvasElement, ElementFields, Fail } from './types.mjs';
import type { ReceiptInput } from './receipt-contracts.mjs';
import { round, RECEIPT_FIELDS } from './receipt-common.mjs';
export function receiptSetup(input: ReceiptInput, at: string, fail: Fail) {
  const {
    type: _type,
    x = 0,
    y = 0,
    w: width,
    size: s = 30,
    merchant,
    detail,
    items = [],
    tax,
    tip,
    total,
    paid,
    footer,
    slip = false,
    lines,
    currency = '$',
    marks,
    shadow = true,
    ...rest
  } = input;
  for (const key of Object.keys(input))
    if (
      key !== 'type' &&
      !RECEIPT_FIELDS.includes(key) &&
      ![
        'id',
        'at',
        'say',
        'cue',
        'exitCue',
        'after',
        'dur',
        'enter',
        'exit',
        'exitAt',
        'exitSay',
        'exitAfter',
        'keys',
        'scale',
        'rotate',
        'origin',
        'opacity',
        'note',
        'fill',
        'z',
        'depth',
        'tilt',
        'unfinished',
        'loop',
      ].includes(key)
    )
      fail(
        `${at}: unsupported receipt field ${key} (a receipt takes ${RECEIPT_FIELDS.join(', ')}, plus the timing fields every element takes)`,
      );
  if (typeof merchant !== 'string' || !merchant.trim() || merchant.length > 28)
    fail(
      `${at}.merchant must be the name printed at the top, up to 28 characters`,
    );
  if (!Number.isFinite(s) || s < 18 || s > 60)
    fail(`${at}.size must be 18–60 (the line type, in px)`);
  if (typeof currency !== 'string' || currency.length > 3)
    fail(`${at}.currency must be a short symbol such as "$"`);
  const id = rest.id ?? 'receipt';
  const w = width ?? s * (slip ? 13 : 16);
  const pad = s * 1.1;
  const els: CanvasElement[] = [];
  const text = (
    t: string,
    tx: number,
    ty: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement => ({
    type: 'text',
    text: t,
    x: round(tx),
    y: round(ty),
    size: round(size),
    font,
    fill,
    ...extra,
  });
  const rule = (ry: number): CanvasElement => ({
    type: 'line',
    x1: round(pad),
    y1: round(ry),
    x2: round(w - pad),
    y2: round(ry),
    stroke: 'muted',
    width: Math.max(1.5, s * 0.06),
    dash: [s * 0.3, s * 0.3],
    opacity: 0.7,
  });
  // Mono advances are about 0.6 em: rows are checked to fit, never squeezed into each other.
  const mono = (str: unknown, size = s): number =>
    String(str).length * size * 0.6;
  return {
    input,
    at,
    fail,
    x,
    y,
    s,
    merchant,
    detail,
    items,
    tax,
    tip,
    total,
    paid,
    footer,
    slip,
    lines,
    currency,
    marks,
    shadow,
    rest,
    id,
    w,
    pad,
    els,
    text,
    rule,
    mono,
    cy: pad + s * 1.55,
    sum: 0,
  };
}
