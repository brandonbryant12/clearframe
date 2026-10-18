// Where to go, as an app says it: "Leave › Family leave › New request". A row of chips joined by
// chevrons, each landing on its word, the last (the place you end up) in the accent colour. It
// expands, while the canvas is validated, into a group whose chips carry ids (`ID-1` … `ID-n`), so
// a pointer can press them; a row too wide for its width wraps after a chevron.

export const CRUMB_FIELDS = ['x', 'y', 'w', 'items', 'size', 'anchor'];

const round = v => Math.round(v);

/** The group a crumbs element draws; `fail(message)` throws with the caller's context. */
export function expandCrumbs(input, at, fail) {
  const { type, x = 0, y = 0, w: width, items, size = 40, anchor = 'start', ...rest } = input;
  for (const key of Object.keys(input))
    if (key !== 'type' && !CRUMB_FIELDS.includes(key) && !['id', 'at', 'say', 'cue', 'exitCue', 'after', 'dur', 'enter', 'exit', 'exitAt', 'exitSay', 'exitAfter', 'keys', 'scale', 'origin', 'opacity', 'note', 'unfinished'].includes(key))
      fail(`${at}: unsupported crumbs field ${key} (crumbs take ${CRUMB_FIELDS.join(', ')}, plus the timing fields every element takes)`);
  if (!Array.isArray(items) || items.length < 2 || items.length > 5) fail(`${at}.items must be 2–5 steps: {label, say|at}, or labels`);
  if (!Number.isFinite(size) || size < 28 || size > 72) fail(`${at}.size must be 28–72 (the chip type, in px)`);
  if (!['start', 'middle'].includes(anchor)) fail(`${at}.anchor must be start or middle`);
  const steps = items.map((it, i) => {
    const step = typeof it === 'string' ? { label: it } : it;
    if (!step || typeof step.label !== 'string' || !step.label.trim() || step.label.length > 24) fail(`${at}.items[${i}] must be a label of up to 24 characters, or {label, say|at}`);
    for (const key of Object.keys(step)) if (!['label', 'say', 'at', 'after'].includes(key)) fail(`${at}.items[${i}]: unsupported field ${key}`);
    return step;
  });
  const id = rest.id ?? 'crumbs';
  const h = round(size * 1.9),
    padX = round(size * 0.62),
    gap = round(size * 1.15);
  // Chip widths from the label's advance (the strong face is about 0.56 em a letter).
  const chipW = label => round(label.length * size * 0.56 + padX * 2);
  const limit = width ?? Infinity;
  const rows = [[]];
  let lineW = 0;
  steps.forEach((s, i) => {
    const cw = chipW(s.label);
    const need = (rows.at(-1).length ? gap : 0) + cw;
    if (rows.at(-1).length && lineW + need > limit) {
      rows.push([]);
      lineW = 0;
    }
    rows.at(-1).push({ ...s, i, cw });
    lineW += (rows.at(-1).length > 1 ? gap : 0) + cw;
  });
  const children = [];
  const whenOf = c => (c.say != null ? { say: c.say, ...(c.after != null ? { after: c.after } : {}) } : c.at != null ? { at: c.at } : {});
  rows.forEach((row, r) => {
    const total = row.reduce((n, c, k) => n + c.cw + (k ? gap : 0), 0);
    let cx = anchor === 'middle' ? -total / 2 : 0;
    const cy = r * (h + round(size * 0.5));
    row.forEach(c => {
      const last = c.i === steps.length - 1;
      children.push({
        type: 'group', id: `${id}-${c.i + 1}`, ...whenOf(c), enter: 'pop', dur: 0.3,
        children: [
          { type: 'rect', x: round(cx), y: round(cy), w: c.cw, h, r: round(h / 2), fill: last ? 'accent' : 'surface', stroke: last ? 'none' : 'line', width: 2, enter: 'none' },
          { type: 'text', text: c.label, x: round(cx + c.cw / 2), y: round(cy + h * 0.66), size, font: 'strong', fill: last ? 'bg' : 'ink', anchor: 'middle', enter: 'none' },
        ],
      });
      // A chevron after every chip but the last, arriving with the step it points to (at the
      // end of the row when that step wraps to the next).
      if (!last) {
        const vx = cx + c.cw + gap / 2;
        children.push({ type: 'path', d: `M ${round(vx - size * 0.14)} ${round(cy + h / 2 - size * 0.26)} L ${round(vx + size * 0.14)} ${round(cy + h / 2)} L ${round(vx - size * 0.14)} ${round(cy + h / 2 + size * 0.26)}`, fill: 'none', stroke: 'muted', width: Math.max(3, round(size * 0.08)), cap: 'round', join: 'round', ...whenOf(steps[c.i + 1]), enter: 'fade', dur: 0.25 });
      }
      cx += c.cw + gap;
    });
  });
  return { type: 'group', ...rest, id, x, y, children };
}
