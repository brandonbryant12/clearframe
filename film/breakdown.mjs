// Part-to-whole breakdowns that reconcile and drill down. A total and its parts are rows on one
// scale (the total is the full bar). A part opens into its own parts: its bar breaks into theirs,
// sized from the part's own bar, so the quantity moves rather than appearing twice, and in the
// opened view the part is an outline its parts fill on their own scale. Gathering reverses it: the
// parts slide back into their slices of the part's bar, which replaces them when they meet.
//
// Every parent must equal its parts exactly (to floating-point precision), or carry an explicit,
// labelled remainder that is a real (positive) share of it. A negative remainder is not a share:
// that reconciliation is a bridge (film/bridge.mjs). What is printed must add up too: at the chosen
// decimals no part (remainder included) may print as zero, and the printed parts must add up to the
// printed parent; otherwise more decimals are asked for. Authored values are never changed, and bar
// geometry is exactly proportional, however small a share (a tiny part is found by its name, value
// and an outline marker, never by enlarging its bar). Ids are stable across beats (`bd-ID-PART-…`), so a
// whole beat, an opened beat and a gathered beat cut into one another.
import { plotLayout, titleText, titleShift } from './plots.mjs';
import { utcDay } from './plot-data.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`breakdown: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
const show = { at: 0, enter: 'none' };
// Layout estimate only (about half an em per character); `fit` caps each line at its room and the
// native frame audit in `check` is what proves nothing overflows.
const textWidth = (value, size) => String(value).length * size * 0.56;
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 24).replace(/-+$/, '') || 'part';
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k} (it takes ${keys.join(', ')})`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const timing = (v, name) => {
  const given = ['say', 'cue', 'at'].filter(k => v[k] != null);
  check(given.length <= 1, `${name} takes one of say, cue or at`);
  check(v.say == null || (typeof v.say === 'string' && v.say.trim() && v.say.length <= 40), `${name}.say is a word or short phrase from the narration`);
  check(v.cue == null || (typeof v.cue === 'string' && v.cue.trim()), `${name}.cue names one of the beat's moments`);
  check(v.at == null || (finite(v.at) && v.at >= 0), `${name}.at is scene seconds`);
  check(v.after == null || (finite(v.after) && v.say != null) || (finite(v.after) && v.cue != null), `${name}.after needs say or cue`);
};
export const RESIDUAL_ID = 'not-explained';
export const MORPH = 0.8;

/** Validate a breakdown, reconcile every parent and return it with ids and explicit remainders. */
export function breakdownSpec(input, source) {
  own(input, ['id', 'title', 'unit', 'asOf', 'source', 'decimals', 'prefix', 'suffix', 'total', 'parts', 'residual', 'focus', 'open', 'gather', 'motion'], 'breakdown');
  const p = { id: 'breakdown', decimals: 0, prefix: '', suffix: '', ...structuredClone(input) };
  check(typeof p.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(p.id), 'id is a short lowercase name (letters, digits, -) shared by every beat of this breakdown');
  words(p.title, 'title', 70); words(p.unit, 'unit (what the values are, with units)', 45); utcDay(p.asOf);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source = words(p.source ?? source, 'source', 110);
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 3, 'decimals must be 0–3');
  for (const k of ['prefix', 'suffix']) check(typeof p[k] === 'string' && p[k].length <= 8, `${k} must be text up to 8 characters`);
  check(p.motion == null || p.motion === 'none', 'motion is "none" to hold the finished picture');
  // One rounding path for everything printed and everything checked: the formatter's own digits.
  const digits = v => v.toLocaleString('en-US', { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals });
  const fmt = v => `${p.prefix}${digits(v)}${p.suffix}`;
  p.format = fmt;
  // Raw values reconcile exactly (floating-point noise aside); what is printed is checked separately.
  const exact = v => 1e-9 * Math.max(1, Math.abs(v));
  // A printed value in units of its last decimal, read back from exactly what is printed.
  const units = v => Math.round(Number(digits(v).replace(/,/g, '')) * 10 ** p.decimals);
  const printed = (parent, parts, name) => {
    for (const x of parts)
      check(units(x.value) > 0, `${x.label} (${x.value}) prints as ${fmt(0)} at ${p.decimals} decimal${p.decimals === 1 ? '' : 's'}; show more decimals so every part, remainder included, is seen`);
    const sum = parts.reduce((a, x) => a + units(x.value), 0);
    check(sum === units(parent.value),
      `at ${p.decimals} decimal${p.decimals === 1 ? '' : 's'} the parts of ${parent.label} print as ${parts.map(x => fmt(x.value)).join(' + ')} = ${fmt(sum / 10 ** p.decimals)}, next to ${fmt(parent.value)}; ` +
      `show more decimals${p.decimals < 3 ? ` (decimals: ${p.decimals + 1})` : ''} so what is printed adds up`);
  };
  own(p.total, ['label', 'value'], 'total');
  words(p.total.label, 'total.label', 40);
  check(finite(p.total.value) && p.total.value > 0, 'total.value must be a positive number (a breakdown divides a whole)');
  const reconcile = (parent, parts, residual, name) => {
    check(Array.isArray(parts) && parts.length >= 2 && parts.length <= 8, `${name}.parts needs 2–8 parts`);
    const ids = new Set();
    parts.forEach((part, i) => {
      const where = `${name}.parts[${i}]`;
      own(part, ['id', 'label', 'value', 'say', 'cue', 'at', 'after', 'highlight', 'parts', 'residual'], where);
      words(part.label, `${where}.label`, 40);
      check(finite(part.value), `${where}.value must be a number`);
      check(part.value > 0, `${where} (${part.label}) is ${part.value <= 0 ? (part.value === 0 ? 'zero: a part of nothing draws nothing, so leave it out' : 'negative: a share of a whole cannot be negative; show signed changes as a bridge (docs/bridge.md)') : ''}`);
      timing(part, where);
      part.id = part.id ?? slug(part.label);
      check(typeof part.id === 'string' && /^[a-z0-9][a-z0-9-]{0,23}$/.test(part.id), `${where}.id is a short lowercase name`);
      check(part.id !== RESIDUAL_ID && !ids.has(part.id), `${where}: part ids must be unique (two parts are called ${part.id}); give one an id`);
      ids.add(part.id);
      check(part.highlight == null || typeof part.highlight === 'boolean', `${where}.highlight is true or false`);
    });
    check(residual == null || residual === true || (typeof residual === 'string' && residual.trim() && residual.length <= 40),
      `${name}.residual is true or the remainder's label (up to 40 characters)`);
    const sum = parts.reduce((a, x) => a + x.value, 0), gap = parent.value - sum;
    if (Math.abs(gap) <= exact(parent.value)) { printed(parent, parts, name); return parts; }
    check(gap > 0 || residual == null,
      `the parts of ${parent.label} add up to ${fmt(sum)}, more than ${parent.label} (${fmt(parent.value)}) by ${fmt(-gap)}. ` +
      'A negative remainder is not a share of the whole: show this reconciliation as a bridge (docs/bridge.md), or correct the figures');
    check(residual != null,
      `the parts of ${parent.label} add up to ${fmt(sum)}, but ${parent.label} is ${fmt(parent.value)}. ` +
      `Add the difference (${fmt(Math.abs(gap))}) as a part, or set residual: true on ${name === 'breakdown' ? 'the breakdown' : name} to show it as an explicit "Not explained" share`);
    const all = [...parts, { id: RESIDUAL_ID, label: residual === true ? 'Not explained' : residual, value: gap, remainder: true }];
    printed(parent, all, name);
    return all;
  };
  p.parts = reconcile(p.total, p.parts, p.residual, 'breakdown');
  for (const [i, part] of p.parts.entries()) {
    if (part.remainder || part.parts == null) continue;
    part.parts = reconcile(part, part.parts, part.residual, `parts[${i}]`);
    for (const [j, child] of part.parts.entries())
      check(child.remainder || child.parts == null, `parts[${i}].parts[${j}]: a breakdown opens one level per beat; open ${child.label} in a breakdown of its own`);
    delete part.residual;
  }
  const opens = ['focus', 'open', 'gather'].filter(k => p[k] != null);
  check(opens.length <= 1, 'a beat shows the whole, opens one part (open), stays opened on one (focus) or gathers one back (gather)');
  const partOf = (v, name) => {
    const part = p.parts.find(x => x.id === v && !x.remainder);
    check(part, `${name} names a part (${p.parts.filter(x => !x.remainder).map(x => x.id).join(', ')})`);
    check(part.parts, `${name}: ${part.label} has no parts of its own to show`);
    return part;
  };
  if (p.focus != null) partOf(p.focus, 'focus');
  if (p.gather != null) partOf(p.gather, 'gather');
  if (p.open != null) {
    own(p.open, ['part', 'say', 'cue', 'at', 'after'], 'open');
    partOf(p.open.part, 'open.part');
    timing(p.open, 'open');
    check(p.open.say != null || p.open.cue != null || p.open.at != null, 'open needs say, cue or at: the word the part opens on');
  }
  return p;
}

/** Row geometry shared by every view of one breakdown in one frame, so text never rescales. */
function layout(p, frame) {
  const { width: W, height: H } = frame, L = { ...plotLayout(frame) };
  const beside = W >= H;
  // A tall frame keeps type title-safe through the beat's slow push (as sketches do: 11.5% in).
  if (!beside) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const rows = Math.max(p.parts.length, ...p.parts.map(x => x.parts?.length ?? 0)) + 1;
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const top = L.top + shift, bottom = L.bottom, slot = (bottom - top) / rows;
  // The largest type the rows allow, within a readable range for the frame.
  const font = Math.round(Math.min(beside ? 40 : 38, Math.max(beside ? 26 : 28, slot * (beside ? 0.5 : 0.3))));
  const labels = [p.total.label, ...p.parts.flatMap(x => [x.label, ...(x.parts ?? []).map(c => c.label)])];
  const values = [p.total.value, ...p.parts.flatMap(x => [x.value, ...(x.parts ?? []).map(c => c.value)])].map(p.format);
  const valueW = Math.max(...values.map(v => textWidth(v, font))) + font * 0.8;
  const labelW = beside ? Math.min(W * 0.32, Math.max(...labels.map(l => textWidth(l, font))) + font) : 0;
  const left = L.margin + labelW + (beside ? font * 0.6 : 0);
  const right = W - L.margin - (beside ? valueW : 0);
  check(right - left >= W * (beside ? 0.3 : 0.5), 'names or values are too wide for this frame; shorten them');
  // In a tall frame a long name wraps onto a second line above its bar instead of shrinking.
  const room = (right - left) * 0.66;
  const lines = label => {
    let n = 1, line = 0;
    for (const w of label.split(/\s+/)) {
      const ww = textWidth(w, font);
      if (line && line + textWidth(' ', font) + ww > room) { n++; line = ww; } else line += (line ? textWidth(' ', font) : 0) + ww;
    }
    return n;
  };
  const wrap = beside ? 1 : Math.max(...labels.map(lines));
  check(wrap <= 2, 'a name needs more than two lines in this frame; shorten it');
  const thickness = beside ? Math.min(slot * 0.56, 70) : Math.min(slot - font * (0.6 + 1.1 * wrap), 56);
  check(thickness >= (beside ? font * 0.7 : font * 0.6), `too many rows for this frame (${rows}); open fewer parts at once`);
  return { L, W, H, beside, rows, top, slot, font, left, right, labelW, thickness, shift, room, lines };
}

const ids = (p, ...path) => `bd-${p.id}-${path.join('-')}`;

/**
 * One view as rows: the parent (the total, or an opened part drawn as an outline its parts fill)
 * and its parts, each bar `value / parent` of the full width.
 */
function view(p, G, parentKey) {
  const parent = parentKey ? p.parts.find(x => x.id === parentKey) : null;
  const items = parent ? parent.parts : p.parts;
  const scale = parent ? parent.value : p.total.value;
  const accent = items.some(x => x.highlight) ? (x => (x.highlight ? 'accent' : 'muted')) : () => 'accent';
  const rowY = i => G.top + G.slot * (i + 0.5) + (G.beside ? 0 : G.font * 0.55);
  const row = (i, key, label, value, kind) => {
    // Exactly proportional, however thin: a share is never enlarged to be seen.
    const cy = rowY(i), bw = (G.right - G.left) * (value / scale), y = cy - G.thickness / 2;
    const header = kind === 'header' || kind === 'total';
    return {
      key, kind, cy, amount: value,
      bar: { x: G.left, y, w: bw, h: G.thickness },
      // A bar too thin to find gets a separate outline marker at its end (not a quantity).
      marker: bw < 4 ? { type: 'circle', cx: G.left + bw, cy, r: Math.max(6, G.thickness * 0.16), fill: 'none', width: 2 } : null,
      label: G.beside
        ? { type: 'text', text: label, x: G.left - G.font * 0.6, y: cy + G.font * 0.35, size: G.font, anchor: 'end', fit: G.labelW, font: header ? 'strong' : 'semibold', fill: kind === 'residual' ? 'muted' : 'ink' }
        : G.lines(label) > 1
          ? { type: 'text', text: label, x: G.left, y: y - G.font * 1.55, size: G.font, anchor: 'start', width: G.room, leading: 1.1, font: header ? 'strong' : 'semibold', fill: kind === 'residual' ? 'muted' : 'ink' }
          : { type: 'text', text: label, x: G.left, y: y - G.font * 0.45, size: G.font, anchor: 'start', fit: G.room, font: header ? 'strong' : 'semibold', fill: kind === 'residual' ? 'muted' : 'ink' },
      value: G.beside
        ? { type: 'text', text: p.format(value), x: G.left + bw + (bw < 4 ? G.thickness * 0.16 + 12 : 0) + G.font * 0.5, y: cy + G.font * 0.35, size: G.font, anchor: 'start', font: 'figures', fill: kind === 'residual' ? 'muted' : 'ink', fit: G.W - G.L.margin - (G.left + bw) - G.font * 0.5 }
        : { type: 'text', text: p.format(value), x: G.right, y: y - G.font * 0.45, size: G.font, anchor: 'end', font: 'figures', fill: kind === 'residual' ? 'muted' : 'ink', fit: (G.right - G.left) * 0.34 },
    };
  };
  const out = [parent ? row(0, [parent.id], parent.label, parent.value, 'header') : row(0, ['total'], p.total.label, p.total.value, 'total')];
  items.forEach((x, i) => out.push({ ...row(i + 1, parent ? [parent.id, x.id] : [x.id], x.label, x.value, x.remainder ? 'residual' : 'part'), item: x, fill: accent(x) }));
  return out;
}

/** The elements of a view; `times(item, i)` gives each part's arrival. */
function draw(p, G, rows, { header, partTime, labelTime }) {
  const out = [];
  for (const [i, r] of rows.entries()) {
    const id = k => ids(p, ...r.key, k);
    const t = i === 0 ? header : partTime(r, i);
    if (r.kind === 'total')
      out.push({ id: id('bar'), type: 'rect', ...r.bar, r: 4, fill: 'muted', opacity: 0.55, ...show });
    else if (r.kind === 'header')
      // The opened part: an outline its parts fill, on its own scale.
      out.push({ id: id('frame'), type: 'rect', ...r.bar, r: 4, fill: 'none', stroke: 'muted', width: 2, ...labelTime(r, i) });
    else if (r.kind === 'residual')
      out.push({ id: id('bar'), type: 'rect', ...r.bar, r: 4, fill: 'none', stroke: 'muted', width: 2.5, dash: [10, 8], ...t });
    else out.push({ id: id('bar'), type: 'rect', ...r.bar, r: 4, fill: r.fill, ...t });
    if (r.marker) out.push({ id: id('marker'), ...r.marker, stroke: r.kind === 'part' ? r.fill : 'muted', ...(i === 0 ? header : labelTime(r, i)) });
    out.push({ id: id('label'), ...r.label, ...(i === 0 ? header : labelTime(r, i)) });
    out.push({ id: id('value'), ...r.value, ...(i === 0 ? header : labelTime(r, i)) });
  }
  return out;
}

/** Canvas elements for one beat of a breakdown. `when(item, fallback)` resolves say/cue/at. */
export function breakdownElements(p, frame, when = (item, fallback) => item?.at ?? fallback) {
  const G = layout(p, frame);
  const still = p.motion === 'none';
  const title = titleText(p.title, G.L, G.W - 2 * G.L.margin);
  title.id = ids(p, 'title');
  const unit = { id: ids(p, 'unit'), type: 'text', text: p.unit, x: G.L.margin, y: G.L.keyY + G.shift, size: Math.max(G.L.keyType, G.font * 0.8), fill: 'muted', font: 'semibold', fit: G.W - 2 * G.L.margin, ...show };
  const spoken = x => x.say != null || x.cue != null || x.at != null;
  const arrive = (x, fallback, extra = {}) => (still ? show : { at: when(x, fallback), ...extra });
  const frameOf = (r, i) => ({ grow: { enter: 'grow-x', origin: [r.bar.x, r.cy], dur: 0.6 } });
  if (p.focus != null) {
    // Opened: the part's parts come out of its bar (morphFrom partitions it) when the beat before
    // drew it; otherwise they grow on their words like any bars.
    const rows = view(p, G, p.focus);
    let run = 0;
    const els = draw(p, G, rows, {
      header: show,
      partTime: (r, i) => arrive(r.item, 0.3 + (i - 1) * 0.3, frameOf(r, i).grow),
      labelTime: (r, i) => (i === 0 ? arrive({}, MORPH, { enter: 'fade', dur: 0.4 }) : arrive(spoken(r.item) ? { ...r.item, after: (r.item.after ?? 0) } : {}, MORPH + (i - 1) * 0.15, { enter: 'fade', dur: 0.4 })),
    });
    const parent = p.parts.find(x => x.id === p.focus);
    const kids = rows.slice(1);
    for (const [k, r] of kids.entries()) {
      const bar = els.find(e => e.id === ids(p, ...r.key, 'bar'));
      // The parts reconcile exactly with the part (breakdownSpec), so the last slice ends at its end.
      bar.morphFrom = { id: ids(p, p.focus, 'bar'), slice: [run / parent.value, k === kids.length - 1 ? 1 : (run + r.amount) / parent.value] };
      run += r.amount;
    }
    return [title, unit, ...els];
  }
  const rows = view(p, G, null);
  const els = draw(p, G, rows, {
    header: show,
    partTime: (r, i) => arrive(r.item, 0.35 + (i - 1) * 0.35, frameOf(r, i).grow),
    labelTime: (r, i) => arrive(r.item, 0.35 + (i - 1) * 0.35, { enter: 'fade', dur: 0.4 }),
  });
  if (p.gather != null) {
    // Gathered: the opened part's parts slide back into their slices of its bar (same ids as the
    // opened beat, so they morph), and the bar replaces them the frame they arrive.
    const part = p.parts.find(x => x.id === p.gather), bar = els.find(e => e.id === ids(p, part.id, 'bar'));
    let run = 0;
    for (const child of part.parts) {
      const w = bar.w * (child.value / part.value);
      els.push({ id: ids(p, part.id, child.id, 'bar'), type: 'rect', x: bar.x + run, y: bar.y, w, h: bar.h, r: 4,
        ...(child.remainder ? { fill: 'none', stroke: 'muted', width: 2.5, dash: [10, 8] } : { fill: bar.fill }), ...show, exit: 'none', exitAt: MORPH });
      run += w;
    }
    Object.assign(bar, { at: MORPH, enter: 'none', dur: 0 });
    // The rest of the whole comes back around the part once its parts have met, so nothing the
    // part's name passes on its way down is on screen yet.
    const theirs = new Set([part.id].flatMap(k => ['bar', 'label', 'value', 'marker'].map(x => ids(p, k, x))));
    for (const el of els)
      if (!theirs.has(el.id) && !el.id.startsWith(ids(p, part.id) + '-')) Object.assign(el, { at: Math.max(el.at ?? 0, MORPH), enter: 'fade', dur: 0.4 });
  }
  if (p.open != null) {
    // Opened in this beat on its word: the whole steps away, the part's bar breaks into its parts,
    // which travel to their rows on the part's own scale; the part's name and value become its header.
    const t = when(p.open, 1);
    const part = p.parts.find(x => x.id === p.open.part);
    const opened = view(p, G, part.id);
    const header = opened[0];
    for (const el of els) {
      const mine = el.id === ids(p, part.id, 'label') || el.id === ids(p, part.id, 'value');
      if (el.id === ids(p, part.id, 'bar')) Object.assign(el, { exit: 'none', exitAt: t });
      else if (mine) {
        const to = el.id.endsWith('-label') ? header.label : header.value;
        el.keys = [{ at: t, dur: MORPH, ease: 'inOut', x: to.x - el.x, y: to.y - el.y }];
      } else Object.assign(el, { exit: 'fade', exitAt: t, exitDur: 0.4 });
    }
    const src = els.find(e => e.id === ids(p, part.id, 'bar'));
    els.push({ id: ids(p, part.id, 'frame'), type: 'rect', ...header.bar, r: 4, fill: 'none', stroke: 'muted', width: 2, at: t + MORPH, enter: 'fade', dur: 0.4 });
    let run = 0;
    for (const [i, r] of opened.slice(1).entries()) {
      // Each part starts as its slice of the part's bar and travels to its own row.
      const slice = { x: src.x + src.w * (run / part.value), w: src.w * (r.amount / part.value) };
      run += r.amount;
      const fill = r.kind === 'residual' ? { fill: 'none', stroke: 'muted', width: 2.5, dash: [10, 8] } : { fill: r.fill };
      els.push(
        { id: ids(p, ...r.key, 'bar'), type: 'rect', ...r.bar, r: 4, ...fill, at: t, enter: 'none', origin: [r.bar.x, r.cy],
          keys: [{ at: t, dur: 0, x: slice.x - r.bar.x, y: src.y + src.h / 2 - r.cy, scaleX: slice.w / r.bar.w, scaleY: src.h / r.bar.h },
            { at: t + 0.02, dur: MORPH, ease: 'inOut', x: 0, y: 0, scaleX: 1, scaleY: 1 }] },
        { id: ids(p, ...r.key, 'label'), ...r.label, at: t + MORPH + i * 0.12, enter: 'fade', dur: 0.4 },
        { id: ids(p, ...r.key, 'value'), ...r.value, at: t + MORPH + i * 0.12, enter: 'fade', dur: 0.4 },
        ...(r.marker ? [{ id: ids(p, ...r.key, 'marker'), ...r.marker, stroke: r.kind === 'part' ? r.fill : 'muted', at: t + MORPH + i * 0.12, enter: 'fade', dur: 0.4 }] : []),
      );
    }
  }
  return [title, unit, ...els];
}

/** The last arrival of a breakdown's elements (its reading hold starts there). */
export const breakdownSettle = elements => Math.max(0, ...elements.filter(e => /^bd-/.test(e.id ?? '')).map(e => (e.at ?? 0) + (e.dur ?? 0.6) + Math.max(0, ...(e.keys ?? []).map(k => k.at + (k.dur ?? 0) - (e.at ?? 0)))));

export function expandBreakdownProps(input, frame) {
  if (input?.breakdown == null) return input;
  const { breakdown, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'viewDrift', 'title', 'diagram', 'process', 'decision'])
    check(rest[key] == null, `cannot combine breakdown with ${key}`);
  const p = breakdownSpec(breakdown, rest.source);
  const when = frame.when ? (item, fallback) => (item && (item.say != null || item.cue != null || item.at != null) ? frame.when(item, fallback, 'breakdown') : fallback) : (item, fallback) => item?.at ?? fallback;
  const elements = breakdownElements(p, frame, when);
  const settle = breakdownSettle(elements);
  if (frame.duration != null)
    check(settle <= frame.duration, `the breakdown finishes at ${settle.toFixed(2)} s, after the beat ends; cue the parts earlier or lengthen the beat`);
  const L = plotLayout(frame);
  return { ...rest, sourceSize: Math.max(30, L.type * 0.95), source: `${p.source} · ${p.asOf}`, view: rest.view ?? [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
