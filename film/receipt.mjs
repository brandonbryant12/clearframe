// A receipt: the paper an expense, FSA or HSA claim turns on, drawn from its lines so the total
// always adds up. It expands, while the canvas is validated, into an ordinary group whose parts
// carry ids (`ID-merchant`, `ID-item-1`…, `ID-tax`, `ID-total`), so `marks` ring its words, a
// `pointer` presses its total, keys move it and a later beat morphs it by id. `slip: true` draws a
// card slip instead: the merchant, a few printed lines and the total, no items (it is not a receipt).

export const RECEIPT_FIELDS = ['x', 'y', 'w', 'size', 'merchant', 'detail', 'items', 'tax', 'tip', 'total', 'paid', 'footer', 'slip', 'lines', 'currency', 'marks', 'shadow'];

const money = (v, currency) => `${v < 0 ? '-' : ''}${currency}${Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const round = v => Math.round(v * 10) / 10;

/** Whether `phrase` occurs in `text` on word boundaries (as text marks match). */
function hasWords(text, phrase) {
  const word = c => c != null && /[\p{L}\p{N}]/u.test(c);
  for (let i = text.indexOf(phrase); i >= 0; i = text.indexOf(phrase, i + 1)) if (!word(text[i - 1]) && !word(text[i + phrase.length])) return true;
  return false;
}

/** The group a receipt element draws; `fail(message)` throws with the caller's context. */
export function expandReceipt(input, at, fail) {
  const { type, x = 0, y = 0, w: width, size: s = 30, merchant, detail, items = [], tax, tip, total, paid, footer, slip = false, lines, currency = '$', marks, shadow = true, ...rest } = input;
  for (const key of Object.keys(input)) if (key !== 'type' && !RECEIPT_FIELDS.includes(key) && !['id', 'at', 'say', 'after', 'dur', 'enter', 'exit', 'exitAt', 'exitSay', 'exitAfter', 'keys', 'scale', 'rotate', 'origin', 'opacity', 'note', 'fill', 'z', 'depth', 'tilt', 'unfinished', 'loop'].includes(key))
    fail(`${at}: unsupported receipt field ${key} (a receipt takes ${RECEIPT_FIELDS.join(', ')}, plus the timing fields every element takes)`);
  if (typeof merchant !== 'string' || !merchant.trim() || merchant.length > 28) fail(`${at}.merchant must be the name printed at the top, up to 28 characters`);
  if (!Number.isFinite(s) || s < 18 || s > 60) fail(`${at}.size must be 18–60 (the line type, in px)`);
  if (typeof currency !== 'string' || currency.length > 3) fail(`${at}.currency must be a short symbol such as "$"`);
  const id = rest.id ?? 'receipt';
  const w = width ?? s * (slip ? 13 : 16);
  const pad = s * 1.1;
  const els = [];
  const text = (t, tx, ty, size, font, fill, extra = {}) => ({ type: 'text', text: t, x: round(tx), y: round(ty), size: round(size), font, fill, ...extra });
  const rule = ry => ({ type: 'line', x1: round(pad), y1: round(ry), x2: round(w - pad), y2: round(ry), stroke: 'muted', width: Math.max(1.5, s * 0.06), dash: [s * 0.3, s * 0.3], opacity: 0.7 });
  // Mono advances are about 0.6 em: rows are checked to fit, never squeezed into each other.
  const mono = (str, size = s) => String(str).length * size * 0.6;
  let cy = pad + s * 1.55;
  els.push(text(merchant.toUpperCase(), w / 2, cy, s * 1.9, 'poster', 'ink', { anchor: 'middle', id: `${id}-merchant` }));
  if (detail != null) {
    if (typeof detail !== 'string' || detail.length > 40) fail(`${at}.detail must be one short line (an address, a date), up to 40 characters`);
    cy += s * 1.6;
    els.push(text(detail, w / 2, cy, s * 0.8, 'mono', 'muted', { anchor: 'middle', id: `${id}-detail` }));
  }
  let sum = 0;
  if (slip) {
    if (items.length) fail(`${at}: a card slip prints no items (that is what makes it not a receipt); drop slip for an itemised receipt`);
    const printed = lines ?? ['CARD PAYMENT', 'APPROVED'];
    if (!Array.isArray(printed) || printed.length > 4 || printed.some(l => typeof l !== 'string' || l.length > 24)) fail(`${at}.lines must be up to four short printed lines`);
    cy += s * 0.6;
    printed.forEach((l, i) => {
      cy += s * 1.4;
      els.push(text(l, w / 2, cy, s * 0.85, 'mono', i ? 'muted' : 'ink', { anchor: 'middle', id: `${id}-line-${i + 1}` }));
    });
    if (!Number.isFinite(total)) fail(`${at}.total must be the amount the slip prints`);
    sum = total;
  } else {
    if (lines != null) fail(`${at}.lines belongs to a card slip (slip: true)`);
    if (!Array.isArray(items) || items.length < 1 || items.length > 8) fail(`${at}.items must be 1–8 lines: {qty, name, price} with price the line's amount`);
    cy += s * 0.9;
    els.push(rule(cy));
    cy += s * 0.4;
    const qtyW = items.some(it => it.qty != null) ? Math.max(...items.map(it => mono(it.qty ?? ''))) + s * 0.9 : 0;
    const priceW = Math.max(...items.map(it => mono(money(it.price ?? 0, currency))));
    items.forEach((it, i) => {
      const where = `${at}.items[${i}]`;
      if (!it || typeof it !== 'object' || typeof it.name !== 'string' || !it.name.trim()) fail(`${where} needs a name`);
      if (!Number.isFinite(it.price)) fail(`${where}.price must be the line's amount (a number)`);
      if (it.qty != null && !(Number.isInteger(it.qty) && it.qty > 0 && it.qty < 1000)) fail(`${where}.qty must be a whole number`);
      for (const key of Object.keys(it)) if (!['qty', 'name', 'price'].includes(key)) fail(`${where}: unsupported field ${key}`);
      if (mono(it.name) > w - pad * 2 - qtyW - priceW - s) fail(`${where}.name "${it.name}" is too long for the receipt's width: shorten it or widen the receipt (w)`);
      cy += s * 1.55;
      els.push({
        type: 'group', id: `${id}-item-${i + 1}`,
        children: [
          ...(it.qty != null ? [text(String(it.qty), pad, cy, s, 'mono', 'ink')] : []),
          text(it.name, pad + qtyW, cy, s, 'mono', 'ink'),
          text(money(it.price, currency), w - pad, cy, s, 'mono', 'ink', { anchor: 'end' }),
        ],
      });
      sum += it.price;
    });
    for (const [key, label, value] of [['tax', 'Tax', tax], ['tip', 'Tip', tip]]) {
      if (value == null) continue;
      if (!Number.isFinite(value)) fail(`${at}.${key} must be an amount`);
      cy += s * 1.45;
      els.push({ type: 'group', id: `${id}-${key}`, children: [text(label, pad + qtyW, cy, s, 'mono', 'muted'), text(money(value, currency), w - pad, cy, s, 'mono', 'muted', { anchor: 'end' })] });
      sum += value;
    }
    // The total is the sum of the lines: a receipt on screen that does not add up is a wrong figure.
    if (total != null && (!Number.isFinite(total) || Math.abs(total - sum) > 0.005))
      fail(`${at}.total is ${total}, but the items${tax != null ? ', tax' : ''}${tip != null ? ' and tip' : ''} add up to ${money(sum, currency)}: correct a line or the total`);
  }
  cy += s * 0.95;
  els.push(rule(cy));
  cy += s * 1.75;
  els.push({ type: 'group', id: `${id}-total`, children: [text('TOTAL', pad, cy, s * 1.15, 'mono', 'ink'), text(money(sum, currency), w - pad, cy, s * 1.15, 'mono', 'ink', { anchor: 'end' })] });
  if (paid != null) {
    if (typeof paid !== 'string' || paid.length > 32) fail(`${at}.paid must be one short line (e.g. "Visa •••• 4417")`);
    cy += s * 1.4;
    els.push(text(paid, pad, cy, s * 0.8, 'mono', 'muted', { id: `${id}-paid` }));
  }
  if (footer != null) {
    if (typeof footer !== 'string' || footer.length > 32) fail(`${at}.footer must be one short line (e.g. "Example")`);
    cy += s * 1.6;
    els.push(text(footer, w / 2, cy, s * 0.95, 'hand', 'muted', { anchor: 'middle', id: `${id}-footer` }));
  }
  // The paper: square at the top, torn at the foot in an even zigzag.
  const h = cy + pad * 1.2;
  const tooth = Math.max(12, s * 0.7);
  const teeth = Math.max(4, Math.round(w / (tooth * 2)));
  const step = w / teeth;
  let d = `M 0 0 L ${round(w)} 0 L ${round(w)} ${round(h)}`;
  for (let i = teeth - 1; i >= 0; i--) d += ` L ${round(i * step + step / 2)} ${round(h + tooth * 0.6)} L ${round(i * step)} ${round(h)}`;
  d += ' Z';
  const paper = { type: 'path', id: `${id}-paper`, d, fill: rest.fill ?? 'paper', stroke: 'none', ...(shadow ? { shadow: true } : {}) };
  delete rest.fill;
  // Marks name words printed on the receipt; each goes to the line that prints them.
  if (marks != null) {
    if (!Array.isArray(marks) || marks.length < 1 || marks.length > 4) fail(`${at}.marks must be 1–4 marks: {words, style, say|at}`);
    const texts = [];
    const walk = list => list.forEach(el => (el.type === 'text' ? texts.push(el) : el.children && walk(el.children)));
    walk(els);
    marks.forEach((m, i) => {
      const words = String(m?.words ?? '').trim().split(/\s+/).join(' ');
      const home = texts.find(t => hasWords(t.text, words));
      if (!home) fail(`${at}.marks[${i}].words "${words}" are not printed on the receipt (each mark names words of one line: the merchant, an item, an amount)`);
      (home.marks ??= []).push({ ...m, words });
    });
  }
  // Drawn smaller than type can be read (a photo in an upload slot, a thumbnail on a phone): its
  // lines print as bars of their length, the way a thumbnail shows them.
  const scale = Number.isFinite(rest.scale) ? rest.scale : 1;
  if (scale * s < 18) {
    if (marks != null) fail(`${at}.marks: at scale ${scale} its type is ${Math.round(scale * s)} px, too small to mark; mark a receipt drawn at reading size`);
    const bar = t => {
      const bw = Math.min(mono(t.text, t.size), w - pad * 2), bh = Math.max(4, t.size * 0.42);
      const left = t.anchor === 'middle' ? t.x - bw / 2 : t.anchor === 'end' ? t.x - bw : t.x;
      return { type: 'rect', x: round(left), y: round(t.y - t.size * 0.5), w: round(bw), h: round(bh), r: round(bh / 2), fill: t.fill === 'muted' ? 'muted' : 'ink', opacity: t.fill === 'muted' ? 0.35 : 0.55, ...(t.id ? { id: t.id } : {}) };
    };
    const bars = list => list.map(el => (el.type === 'text' ? bar(el) : el.children ? { ...el, children: bars(el.children) } : el));
    els.splice(0, els.length, ...bars(els));
  }
  // The receipt enters as one piece: its parts wait for the group.
  const still = list => list.map(el => ({ ...el, enter: 'none', ...(el.children ? { children: still(el.children) } : {}) }));
  return { type: 'group', ...rest, id, x, y, children: still([paper, ...els]) };
}
