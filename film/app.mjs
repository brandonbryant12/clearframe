// An app screen: the step a workplace film asks people to take, drawn from what is on it. A
// window (or a phone) with the app's name and tabs, a panel with its heading, an optional upload
// slot (holding a receipt's photo once it is added), fields whose values type in on their words,
// and a button that becomes its confirmation when pressed; with `pages`, screens that take over
// on their words (a list of rows to tap, then a form). It expands, while the canvas is
// validated, into ordinary elements whose parts carry ids (`ID-tab-claims`, `ID-upload`,
// `ID-field-amount`, `ID-button`), so a `pointer` presses them by id and keys move the whole.
import { expandReceipt } from './receipt.mjs';

export const APP_FIELDS = ['x', 'y', 'w', 'h', 'device', 'title', 'tabs', 'heading', 'open', 'upload', 'fields', 'button', 'pages', 'size'];
const TIMING = ['id', 'at', 'say', 'after', 'dur', 'enter', 'exit', 'exitAt', 'exitSay', 'exitAfter', 'keys', 'scale', 'rotate', 'origin', 'opacity', 'note', 'z', 'depth', 'unfinished'];

const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = v => Math.round(v);
const when = (spec, extra = 0) => (spec?.say != null ? { say: spec.say, after: (spec.after ?? 0) + extra } : spec?.at != null ? { at: spec.at + extra } : null);

/** The elements an app element draws; `fail(message)` throws with the caller's context. */
export function expandApp(input, at, fail, canvas) {
  for (const key of Object.keys(input))
    if (key !== 'type' && !APP_FIELDS.includes(key) && !TIMING.includes(key)) fail(`${at}: unsupported app field ${key} (an app takes ${APP_FIELDS.join(', ')}, plus the timing fields every element takes)`);
  // A tall frame gets the phone unless told otherwise, as `portal` does.
  const { type, x = 0, y = 0, w: width, h: height, device = canvas && canvas.height > canvas.width * 1.2 ? 'phone' : 'window', title, tabs = [], heading, open, upload, fields = [], button, pages, size = 32, ...rest } = input;
  const id = rest.id ?? 'app';
  const phone = device === 'phone';
  if (!['window', 'phone'].includes(device)) fail(`${at}.device must be window or phone`);
  if (typeof title !== 'string' || !title.trim() || title.length > 28) fail(`${at}.title must be the app's name, up to 28 characters`);
  if (!Array.isArray(tabs) || tabs.length > 3 || tabs.some(t => typeof t !== 'string' || !t.trim() || t.length > 14)) fail(`${at}.tabs must be up to three short tab names`);
  if (!Number.isFinite(size) || size < 24 || size > 48) fail(`${at}.size must be 24–48 (the field type, in px)`);
  const s = size;
  // A window that is the scene's subject fills it; one beside something else says how wide.
  const w = width ?? (phone ? 640 : 1180);
  const pad = phone ? 44 : 48;
  const inner = w - pad * 2;
  const els = [];
  const text = (t, tx, ty, px, font, fill, extra = {}) => ({ type: 'text', text: t, x: round(tx), y: round(ty), size: round(px), font, fill, ...extra });
  const pill = (pid, px, py, pw, ph, label, { fill = 'surface', ink = 'ink', font = 'strong', stroke = fill === 'surface' ? 'muted' : 'none' } = {}) => ({
    type: 'group', id: pid,
    children: [
      { type: 'rect', x: round(px), y: round(py), w: round(pw), h: round(ph), r: round(ph * 0.24), fill, stroke, width: 2 },
      text(label, px + pw / 2, py + ph * 0.64, s, font, ink, { anchor: 'middle' }),
    ],
  });
  // The header: the app's name, its tabs to the right (under it on a phone), a hairline below.
  let cy = phone ? 92 : 0;
  const tabH = round(s * 2.2);
  if (phone) {
    els.push(text(title, pad, cy + s * 1.2, s * 1.3, 'display', 'ink'));
    cy += s * 1.9;
    if (tabs.length) {
      const tw = (inner - (tabs.length - 1) * 14) / tabs.length;
      tabs.forEach((t, i) => els.push(pill(`${id}-tab-${slug(t)}`, pad + i * (tw + 14), cy, tw, tabH, t)));
      cy += tabH + 28;
    }
  } else {
    const head = tabH + 64;
    els.push(text(title, pad, head / 2 + s * 0.42, s * 1.3, 'display', 'ink'));
    const tw = Math.max(...tabs.map(t => t.length * s * 0.62 + s * 1.6), s * 6);
    tabs.forEach((t, i) => els.push(pill(`${id}-tab-${slug(t)}`, w - pad - (tabs.length - i) * tw - (tabs.length - 1 - i) * 16, (head - tabH) / 2, tw, tabH, t)));
    cy = head;
  }
  els.push({ type: 'line', x1: 0, y1: round(cy), x2: round(w), y2: round(cy), stroke: 'line', width: 2 });
  const label = (t, lx, ly) => text(t, lx, ly, s * 0.9, 'text', 'muted');
  const fieldH = round(s * 2.5);
  const used = new Set();
  // Ids stay unique across pages: a part a later page repeats takes that page's number.
  const uid = (base, page) => (used.has(base) ? `${base}-${page + 1}` : (used.add(base), base));
  /** One panel (a page): its heading, rows to tap, upload slot, fields and button. */
  const panelOf = (spec, where, page) => {
    const { heading, rows, upload, fields = [], button } = spec;
    const panel = [];
    let py = cy + pad;
    if (heading != null) {
      if (typeof heading !== 'string' || heading.length > 32) fail(`${where}.heading must be the panel's title, up to 32 characters`);
      panel.push(text(heading, pad, py + s * 1.15, s * 1.4, 'strong', 'ink'));
      py += s * 1.4 + s * 1.0;
    }
    // Rows to tap: a list a section opens on, each with a chevron.
    if (rows != null) {
      if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5 || rows.some(r => typeof r !== 'string' || !r.trim() || r.length > 28))
        fail(`${where}.rows must be 1–5 labels of up to 28 characters (what the screen lists to tap)`);
      const rh = round(s * 2.6);
      rows.forEach(r => {
        panel.push({
          type: 'group', id: uid(`${id}-row-${slug(r)}`, page),
          children: [
            { type: 'rect', x: pad, y: round(py), w: inner, h: rh, r: 16, fill: 'bg', stroke: 'line', width: 2 },
            text(r, pad + s * 0.8, py + rh * 0.64, s * 1.05, 'strong', 'ink'),
            { type: 'path', d: `M ${round(pad + inner - s * 1.1)} ${round(py + rh / 2 - s * 0.32)} L ${round(pad + inner - s * 0.75)} ${round(py + rh / 2)} L ${round(pad + inner - s * 1.1)} ${round(py + rh / 2 + s * 0.32)}`, fill: 'none', stroke: 'muted', width: 3, cap: 'round', join: 'round' },
          ],
        });
        py += rh + s * 0.5;
      });
      py += s * 0.4;
    }
    // An upload slot: left of the fields in a window, above them on a phone.
    let fx = pad,
      fw = inner,
      slot = null;
    if (upload != null) {
      if (typeof upload !== 'object' || typeof upload.label !== 'string' || upload.label.length > 24) fail(`${where}.upload must be {label, receipt, say|at}: the slot's caption (e.g. "Add receipt") and, optionally, the receipt whose photo lands in it`);
      for (const key of Object.keys(upload)) if (!['label', 'receipt', 'say', 'at', 'after'].includes(key)) fail(`${where}.upload: unsupported field ${key}`);
      slot = phone ? { x: pad, y: py, w: inner, h: round(s * 7.5) } : { x: pad, y: py, w: round(inner * 0.36), h: round(s * 7.2) };
      panel.push({
        type: 'group', id: uid(`${id}-upload`, page),
        children: [
          { type: 'rect', ...slot, r: 18, fill: 'none', stroke: 'muted', width: 3, dash: [12, 9] },
          text(upload.label, slot.x + slot.w / 2, slot.y + slot.h + s * 1.35, s * 0.9, 'text', 'muted', { anchor: 'middle' }),
        ],
      });
      if (phone) py += slot.h + s * 2.4;
      else ((fx = slot.x + slot.w + 40), (fw = w - pad - fx));
    }
    if (!Array.isArray(fields) || fields.length > 4) fail(`${where}.fields must be up to four {label, value, say|at}`);
    fields.forEach((f, i) => {
      const at2 = `${where}.fields[${i}]`;
      if (!f || typeof f !== 'object' || typeof f.label !== 'string' || !f.label.trim() || f.label.length > 24) fail(`${at2}.label must be the field's name, up to 24 characters`);
      if (f.value != null && (typeof f.value !== 'string' || f.value.length > 24)) fail(`${at2}.value must be what it holds, up to 24 characters`);
      for (const key of Object.keys(f)) if (!['label', 'value', 'say', 'at', 'after', 'id'].includes(key)) fail(`${at2}: unsupported field ${key}`);
      const fid = f.id ?? uid(`${id}-field-${slug(f.label)}`, page);
      const top = (upload != null && !phone ? slot.y : py) + i * (fieldH + s * 1.9);
      panel.push(label(f.label, fx, top + s * 0.9));
      panel.push({ type: 'rect', id: fid, x: round(fx), y: round(top + s * 1.4), w: round(fw), h: fieldH, r: 14, fill: 'bg', stroke: 'line', width: 2 });
      if (f.value != null) {
        const typed = when(f);
        if (f.value.length * s * 0.6 > fw - s * 1.6) fail(`${at2}.value "${f.value}" is too long for the field: shorten it or widen the app (w)`);
        panel.push(text(f.value, fx + s * 0.8, top + s * 1.4 + fieldH * 0.66, s * 1.15, 'strong', 'ink', typed ? { ...typed, enter: 'type', dur: 0.45 } : {}));
      }
    });
    const fieldsEnd = (upload != null && !phone ? slot.y : py) + fields.length * (fieldH + s * 1.9);
    py = Math.max(fieldsEnd, slot && !phone ? slot.y + slot.h + s * 2.2 : 0, py);
    // The button, and what it becomes once pressed.
    let bottom = py + pad;
    if (button != null) {
      if (typeof button !== 'object' || typeof button.label !== 'string' || !button.label.trim() || button.label.length > 18) fail(`${where}.button must be {label, done, say|at}: the button's words and, pressed on its word, what it becomes ("Claim sent")`);
      for (const key of Object.keys(button)) if (!['label', 'done', 'say', 'at', 'after'].includes(key)) fail(`${where}.button: unsupported field ${key}`);
      const bh = round(s * 2.8);
      const bw = phone ? inner : Math.max(s * 9, button.label.length * s * 0.62 + s * 3, (button.done ?? '').length * s * 0.62 + s * 3);
      const b = { x: w - pad - bw, y: py + s * 0.4, w: bw, h: bh };
      const pressed = when(button, 0.3);
      panel.push({ ...pill(uid(`${id}-button`, page), b.x, b.y, b.w, b.h, button.label, { fill: 'accent', ink: 'bg' }), ...(button.done != null && pressed ? { ...(pressed.say != null ? { exitSay: pressed.say, exitAfter: pressed.after } : { exitAt: pressed.at }), exit: 'fade' } : {}) });
      if (button.done != null) {
        if (typeof button.done !== 'string' || button.done.length > 18) fail(`${where}.button.done must be what the button becomes, up to 18 characters`);
        if (!pressed) fail(`${where}.button: a button with done needs say (the word it is pressed on) or at`);
        panel.push({ ...pill(uid(`${id}-done`, page), b.x, b.y, b.w, b.h, button.done, { fill: 'positive', ink: 'bg' }), ...pressed, enter: 'pop', dur: 0.3 });
      }
      bottom = b.y + bh + pad;
    }
    // The receipt's photo, at the size of an attachment, landing in the slot on its word.
    if (upload?.receipt != null) {
      if (typeof upload.receipt !== 'object') fail(`${where}.upload.receipt must be a receipt's lines (merchant, items, tax…)`);
      const rw = upload.receipt.w ?? (upload.receipt.size ?? 30) * (upload.receipt.slip ? 13 : 16);
      const k = Math.min((slot.w - 36) / rw, 0.5);
      const [px, py0] = [round(slot.x + (slot.w - rw * k) / 2), round(slot.y + 16)];
      const lands = when(upload);
      panel.push(expandReceipt({ type: 'receipt', ...upload.receipt, id: uid(`${id}-photo`, page), x: px, y: py0, scale: k, origin: [px, py0], shadow: false, ...(lands ?? {}), enter: lands ? 'pop' : 'none' }, `${where}.upload.receipt`, fail));
    }
    return { panel, bottom };
  };
  let h;
  if (pages != null) {
    // Pages: each takes over the screen on its word, sliding in as an app's next screen does.
    if (!Array.isArray(pages) || pages.length < 2 || pages.length > 5) fail(`${at}.pages must be 2–5 pages: {heading, rows | upload, fields, button, say|at}`);
    for (const key of ['heading', 'open', 'upload', 'fields', 'button']) if (input[key] != null) fail(`${at}.${key} belongs to a page when the app has pages`);
    const built = pages.map((p, k) => {
      if (!p || typeof p !== 'object') fail(`${at}.pages[${k}] must be a page`);
      for (const key of Object.keys(p)) if (!['heading', 'rows', 'upload', 'fields', 'button', 'say', 'at', 'after'].includes(key)) fail(`${at}.pages[${k}]: unsupported field ${key}`);
      if (k > 0 && !when(p)) fail(`${at}.pages[${k}] needs say (the word it opens on) or at`);
      return panelOf(p, `${at}.pages[${k}]`, k);
    });
    h = Math.max(...built.map(b => b.bottom), height ?? 0);
    built.forEach(({ panel }, k) => {
      // The page that is leaving clears quickly as the next one slides in a moment later, so
      // the two screens' words never sit on top of each other.
      const opens = k > 0 ? { ...when(pages[k], 0.2), enter: 'right', dist: 40, dur: 0.35 } : {};
      const next = pages[k + 1] && when(pages[k + 1]);
      const leaves = next ? { ...(next.say != null ? { exitSay: next.say, exitAfter: next.after } : { exitAt: next.at }), exit: 'fade', exitDur: 0.15 } : {};
      els.push({ type: 'group', ...opens, ...leaves, children: panel });
    });
  } else {
    const { panel, bottom } = panelOf({ heading, upload, fields, button }, at, 0);
    h = Math.max(bottom, height ?? 0);
    const opened = when(open);
    if (open != null && !opened) fail(`${at}.open must be {say|at}: the word the panel opens on`);
    els.push(opened ? { type: 'group', ...opened, enter: 'rise', dist: 24, children: panel } : { type: 'group', children: panel });
  }
  // The device: a window with a soft shadow, or a phone's body round its screen.
  const frame = phone
    ? [
        { type: 'rect', x: -18, y: -18, w: w + 36, h: h + 36, r: 70, fill: 'ink', shadow: true },
        { type: 'rect', x: 0, y: 0, w, h, r: 54, fill: 'paper' },
        { type: 'rect', x: round(w / 2 - 70), y: 22, w: 140, h: 30, r: 15, fill: 'ink' },
      ]
    : [{ type: 'rect', x: 0, y: 0, w, h, r: 30, fill: 'paper', shadow: true }];
  // Parts wait for the screen unless they have a word of their own.
  const still = list => list.map(el => ({ ...el, ...(el.say == null && el.at == null ? { enter: 'none' } : {}), ...(el.children ? { children: still(el.children) } : {}) }));
  return { type: 'group', ...rest, id, x, y, children: still([...frame, ...els]) };
}
