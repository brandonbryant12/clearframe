// One table, several audience views. Cell slots never move; hidden values do not
// produce text elements during that view. This is presentation, not access control.
import { plotLayout, titleText, titleShift } from './plots.mjs';
import { utcDay } from './plot-data.mjs';
const check = (ok, message) => { if (!ok) throw new Error(`table: ${message}`); };
const ID = /^[a-z][a-z0-9-]{0,23}$/;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
const label = (v, name, max = 80) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const shown = { at: 0, enter: 'none' };
export function tableSpec(input) {
  own(input, ['id', 'title', 'source', 'asOf', 'columns', 'rows', 'views', 'show'], 'table');
  const p = { id: 'table', ...structuredClone(input) };
  check(typeof p.id === 'string' && ID.test(p.id), 'id is a short lowercase name');
  label(p.title, 'title', 70); label(p.source, 'source', 110); if (p.asOf != null) utcDay(p.asOf);
  check(Array.isArray(p.columns) && p.columns.length >= 1 && p.columns.length <= 6, 'use 1–6 columns');
  const cols = new Set();
  for (const c of p.columns) {
    own(c, ['id', 'label', 'align', 'weight'], 'column');
    check(typeof c.id === 'string' && ID.test(c.id) && !cols.has(c.id), 'column ids must be unique short lowercase names'); cols.add(c.id);
    label(c.label, `column ${c.id} label`, 32);
    c.align ??= 'left'; c.weight ??= 1;
    check(['left', 'right'].includes(c.align), `column ${c.id} align must be left or right`);
    check(Number.isFinite(c.weight) && c.weight >= 0.5 && c.weight <= 4, `column ${c.id} weight must be between 0.5 and 4`);
  }
  check(Array.isArray(p.rows) && p.rows.length >= 1 && p.rows.length <= 8, 'use 1–8 rows; split longer tables into shots');
  const rows = new Set();
  for (const r of p.rows) {
    own(r, ['id', 'cells'], 'row');
    check(typeof r.id === 'string' && ID.test(r.id) && !rows.has(r.id), 'row ids must be unique short lowercase names'); rows.add(r.id);
    own(r.cells, [...cols], `row ${r.id} cells`);
    for (const c of p.columns) label(r.cells[c.id], `row ${r.id}, column ${c.id} (format numbers with their units)`);
  }
  if (p.views == null) p.views = [{ id: 'all', label: 'All records', hide: [] }];
  check(Array.isArray(p.views) && p.views.length >= 1 && p.views.length <= 6, 'views needs 1–6 audience views');
  const views = new Set();
  for (const v of p.views) {
    own(v, ['id', 'label', 'hide'], 'view');
    check(typeof v.id === 'string' && ID.test(v.id) && !views.has(v.id), 'view ids must be unique short lowercase names'); views.add(v.id);
    label(v.label, `view ${v.id} label`, 60); v.hide ??= [];
    check(Array.isArray(v.hide) && new Set(v.hide).size === v.hide.length && v.hide.every(c => cols.has(c)), `view ${v.id} hide must name unique columns`);
  }
  p.show ??= [];
  check(Array.isArray(p.show) && p.show.length <= 12, 'show takes at most 12 audience changes');
  for (const s of p.show) {
    own(s, ['view', 'at', 'say', 'cue', 'after'], 'show');
    check(views.has(s.view), `show names unknown view ${s.view}`);
    check(['at', 'say', 'cue'].filter(k => s[k] != null).length === 1, 'each show needs exactly one of at, say or cue');
    if (s.at != null) check(Number.isFinite(s.at) && s.at >= 0, 'show.at must be nonnegative scene seconds');
    for (const k of ['say', 'cue']) if (s[k] != null) label(s[k], `show.${k}`);
    check(s.after == null || (Number.isFinite(s.after) && (s.say != null || s.cue != null)), 'show.after needs a word or named cue');
  }
  return p;
}

export function tableElements(p, frame, when = (s) => s.at) {
  const { width: W, height: H } = frame, L = { ...plotLayout(frame) }, tall = H > W;
  if (tall) L.margin = Math.max(L.margin, W * .115 + 4);
  check(!tall || p.columns.length <= 3, 'portrait tables take at most 3 columns; choose a smaller table or a landscape shot');
  const width = W - 2 * L.margin, shift = titleShift(p.title, L, width), u = Math.min(W, H) / 1080;
  const font = (p.columns.length > 4 ? 28 : 40) * u, pad = 16 * u;
  let top = L.keyY + shift + (tall ? 85 : 65) * u;
  const bottom = L.bottom;
  const headerH = font * 2.3, rowH = Math.min((bottom - top - headerH) / p.rows.length, font * 3.5);
  if (tall) top += Math.max(0, (bottom - top - headerH - rowH * p.rows.length) / 2);
  check(rowH >= font * 1.65, 'too many rows below this title; shorten the title or split the table');
  const totalWeight = p.columns.reduce((a,c) => a + c.weight, 0);
  let x = L.margin;
  const columns = p.columns.map(c => { const w = width * c.weight / totalWeight; const out = { ...c, x, w }; x += w; return out; });
  const intervals = [{ at: 0, view: p.views[0] }];
  for (const s of p.show) {
    const at = when(s);
    check(Number.isFinite(at) && at >= 0 && (frame.duration == null || at < frame.duration), `view ${s.view} must start inside the beat`);
    check(at > intervals.at(-1).at || (at === 0 && intervals.length === 1), 'audience changes must be in increasing time order');
    const value = { at, view: p.views.find(v => v.id === s.view) };
    if (at === 0) intervals[0] = value; else intervals.push(value);
  }
  const title = titleText(p.title, L, width); title.id = `tbl-${p.id}-title`;
  const elements = [title];
  // Only the grid carries across cuts. Timed text/redactions belong to this beat;
  // generic id morphing otherwise pulls a later reveal back to time zero.
  const timingId = frame.beatId ?? 'standalone';
  const window = (i) => ({ at: intervals[i].at, enter: 'none', ...(i + 1 < intervals.length ? { exit: 'none', exitAt: intervals[i+1].at } : {}) });
  for (const [i, s] of intervals.entries()) elements.push({ id: `tbl-${p.id}-audience-${timingId}-${i}`, type: 'text', text: s.view.label, x: L.margin, y: L.keyY + shift, size: Math.max(L.keyType, font), fill: 'accent', font: 'semibold', fit: width, ...window(i) });
  elements.push({ id: `tbl-${p.id}-header`, type: 'rect', x: L.margin, y: top, w: width, h: headerH, fill: 'surface', ...shown });
  const text = (id, value, c, y, h, extra = {}) => {
    const room = c.w - 2 * pad;
    // A conservative authoring guard, not font measurement. Native shaping/audit verifies fit.
    const estimate = value.length * font * .56;
    const lines = Math.max(1, Math.ceil(estimate / room));
    check(room >= font * 2.2 && lines <= (c.align === 'right' ? 1 : 2) && lines * font * 1.2 <= h - pad,
      `${id} is too long for its cell; shorten it, increase the column weight or split the table`);
    return { id, type: 'text', text: value, x: c.align === 'right' ? c.x + c.w - pad : c.x + pad,
      y: y + h / 2 + font * .34, size: font, fill: 'ink', font: c.align === 'right' ? 'figures' : 'text',
      ...(lines > 1 && c.align === 'left' ? { y: y + pad / 2, width: room, height: h - pad, } : { anchor: c.align === 'right' ? 'end' : 'start', fit: room }), ...extra };
  };
  for (const c of columns) elements.push(text(`tbl-${p.id}-head-${c.id}`, c.label, { ...c, align: 'left' }, top, headerH, { ...shown, font: 'semibold' }));
  for (const [ri, r] of p.rows.entries()) {
    const y = top + headerH + ri * rowH;
    for (const c of columns) {
      const id = `tbl-${p.id}-${r.id}-${c.id}`;
      // Stable target rectangles are real cell geometry for on/reveal, including hidden cells.
      elements.push({ id, type: 'rect', x: c.x, y, w: c.w, h: rowH, fill: ri % 2 ? 'surface' : 'none', ...shown });
      for (const [i, s] of intervals.entries()) {
        if (s.view.hide.includes(c.id)) {
          elements.push({ id: `${id}-redaction-${timingId}-${i}`, type: 'rect', x: c.x + pad, y: y + rowH * .4, w: Math.min(c.w - 2 * pad, 100 * u), h: 10 * u, r: 5 * u, fill: 'muted', ...window(i) });
        } else elements.push(text(`${id}-text-${timingId}-${i}`, r.cells[c.id], c, y, rowH, window(i)));
      }
    }
    elements.push({ id: `tbl-${p.id}-rule-${r.id}`, type: 'line', x1: L.margin, y1: y + rowH, x2: W - L.margin, y2: y + rowH, stroke: 'line', width: 1.2 * u, ...shown });
  }
  return { elements, intervals };
}

export function expandTableProps(input, frame) {
  if (input?.table == null) return input;
  const { table, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'breakdown', 'process', 'decision', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'title', 'diagram'])
    check(rest[key] == null, `cannot combine table with ${key}`);
  const p = tableSpec(table);
  check(rest.source == null || rest.source === p.source, 'source conflicts with table.source');
  const when = frame.when ? s => frame.when(s, 0, 'table audience') : s => s.at;
  const { elements } = tableElements(p, frame, when);
  return { ...rest, source: p.source + (p.asOf ? ` · ${p.asOf}` : ''), view: rest.view ?? [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
