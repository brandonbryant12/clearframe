// A pointer that goes to an element by id and presses it: the "do it in the app" step without
// placing a coordinate. It expands, before scheduling, into ordinary canvas elements: a cursor
// whose keys travel to each target and press on the spoken word, and a short press on each
// target it touches, so it renders like everything else and follows its targets when the copy
// or the layout changes.
import { elementsExtent } from './canvas.mjs';

// The cursor's outline with its tip at (0, 0), 40 units tall (the macOS arrow's proportions).
const ARROW = 'M 0 0 L 0 40 L 10.5 30.5 L 17 46 L 25 43 L 18.5 28 L 31 28 Z';
export const POINTER_FIELDS = ['to', 'steps', 'from', 'point', 'press', 'style', 'size', 'leave', 'sound'];
const STEP_FIELDS = ['to', 'say', 'at', 'press', 'point'];

const isPoint = v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);

/** Validate a pointer element in place; `fail(message)` throws with the caller's context. */
export function checkPointer(el, at, fail) {
  const steps = el.steps ?? [{ to: el.to, say: el.say, at: el.at, press: el.press, point: el.point }];
  if (el.steps != null && el.to != null) fail(`${at}: a pointer takes either to (one target) or steps (several), not both`);
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8) fail(`${at}.steps must be 1–8 steps: {to: an element id, say|at, press}`);
  steps.forEach((s, i) => {
    const where = el.steps ? `${at}.steps[${i}]` : at;
    if (!s || typeof s !== 'object') fail(`${where} must be an object`);
    for (const key of Object.keys(s)) if (s[key] !== undefined && !STEP_FIELDS.includes(key)) fail(`${where}: unsupported step field ${key}`);
    if (!(typeof s.to === 'string' && s.to.trim()) && !isPoint(s.to))
      fail(`${where}.to must name the id of the element to point at (a button, a field, a card), or be [x, y]`);
    if (s.say == null && s.at == null) fail(`${where} needs say (the word it presses on) or at`);
    if (s.point != null && !(isPoint(s.point) && s.point.every(v => v >= 0 && v <= 1)))
      fail(`${where}.point must be [x, y] fractions of the target's box (default [0.66, 0.68])`);
    if (s.press != null && typeof s.press !== 'boolean') fail(`${where}.press must be true or false`);
  });
  if (el.from != null && !isPoint(el.from)) fail(`${at}.from must be [x, y] frame pixels`);
  if (el.style != null && !['arrow', 'touch'].includes(el.style)) fail(`${at}.style must be arrow (a mouse pointer) or touch (a fingertip)`);
  if (el.size != null && !(Number.isFinite(el.size) && el.size >= 16 && el.size <= 160)) fail(`${at}.size must be 16–160 px`);
  if (el.leave != null && typeof el.leave !== 'boolean') fail(`${at}.leave must be true or false`);
  if (el.sound != null && el.sound !== false && typeof el.sound !== 'string') fail(`${at}.sound must be false or a sound name`);
}

/** Every element with an id, with the offset of the groups it sits in. */
function index(list, dx = 0, dy = 0, out = new Map()) {
  for (const el of list) {
    if (el.id != null && !out.has(el.id)) out.set(el.id, { el, dx, dy });
    if (el.type === 'group') index(el.children ?? [], dx + (el.x ?? 0), dy + (el.y ?? 0), out);
  }
  return out;
}

/** A target's box in frame coordinates at rest, moved by any keys it has finished before `t`. */
function box(entry) {
  const { el, dx, dy } = entry;
  const e = elementsExtent([el]);
  if (!e) return null;
  return { x: dx + e.left, y: dy + e.top, w: e.w, h: e.h };
}

/**
 * Replace each pointer in `list` (in place) with its cursor, and give each target its press.
 * `frame` is the canvas's width and height; `tall` frames default to a fingertip.
 */
export function expandPointers(list, { width = 1920, height = 1080 } = {}) {
  const ids = index(list);
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p?.type !== 'pointer') {
      if (p?.type === 'group' && p.children) expandPointers(p.children, { width, height });
      continue;
    }
    const steps = (p.steps ?? [{ to: p.to, say: p.say, at: p.at, press: p.press, point: p.point }]).map(s => {
      const target = typeof s.to === 'string' ? ids.get(s.to) : null;
      if (typeof s.to === 'string' && !target) throw new Error(`pointer: no element has id "${s.to}" (give the button or field an id)`);
      const b = target ? box(target) : null;
      // The tip rests at the lower right of the target's middle, so the arrow never covers its label.
      const [fx, fy] = s.point ?? [0.66, 0.68];
      const spot = b ? [b.x + b.w * fx, b.y + b.h * fy] : s.to;
      return { ...s, target, spot, press: s.press ?? true };
    });
    const touch = (p.style ?? (height > width ? 'touch' : 'arrow')) === 'touch';
    const size = p.size ?? (touch ? 64 : 46) * (Math.min(width, height) / 1080);
    // It comes in from below and to the right of where it is going, as a hand does, inside the frame.
    const first = steps[0].spot;
    const from = p.from ?? [Math.min(width - size * 1.5, first[0] + width * 0.12), Math.min(height - size * 1.6, first[1] + height * 0.16)];
    // A spoken step lands on its word (`after` seconds off it); a timed one at its seconds.
    const when = (s, offset = 0) => (s.say != null ? { say: s.say, after: offset } : { at: Math.max(0, s.at + offset) });
    const travel = (a, b) => Math.min(1.1, Math.max(0.55, Math.hypot(b[0] - a[0], b[1] - a[1]) / 1100));
    // The outer group's keys carry x and the inner group's y, with different easing, so the
    // cursor travels on a gentle curve rather than a ruler line.
    const xs = [],
      ys = [],
      press = [];
    let here = from;
    for (const s of steps) {
      const dur = travel(here, s.spot);
      xs.push({ ...when(s, -(dur + 0.12)), x: s.spot[0] - from[0], dur, ease: 'inOut' });
      ys.push({ ...when(s, -(dur + 0.12)), y: s.spot[1] - from[1], dur, ease: 'out' });
      if (s.press) {
        press.push({ ...when(s), scale: 0.84, dur: 0.18, ease: 'thereAndBack', ...(p.sound === false ? {} : { sound: p.sound ?? 'click' }) });
        // The thing pressed answers: it dips, then settles where it was.
        if (s.target) s.target.el.keys = [...(s.target.el.keys ?? []), { ...when(s, 0.02), scale: 0.965, dur: 0.22, ease: 'thereAndBack' }];
      }
      here = s.spot;
    }
    const k = size / 40;
    const cursor = touch
      ? { type: 'circle', cx: 0, cy: 0, r: size / 2, fill: 'ink', opacity: 0.26, stroke: 'bg', width: Math.max(2, size * 0.05) }
      : { type: 'path', d: ARROW.replace(/-?\d+(\.\d+)?/g, n => String(Math.round(Number(n) * k * 10) / 10)), fill: 'ink', stroke: 'bg', width: Math.max(2, 3 * k), join: 'round' };
    const last = steps.at(-1);
    list[i] = {
      type: 'group',
      ...(p.id ? { id: p.id } : {}),
      x: from[0],
      y: from[1],
      // On screen a moment before its first move, so it is seen setting off.
      ...when(steps[0], -(travel(from, steps[0].spot) + 0.45)),
      enter: 'fade',
      dur: 0.25,
      keys: xs,
      ...(p.leave ? { ...(last.say != null ? { exitSay: last.say, exitAfter: 0.7 } : { exitAt: last.at + 0.7 }), exit: 'fade' } : {}),
      children: [{ type: 'group', x: 0, y: 0, enter: 'none', keys: ys, children: [{ ...cursor, enter: 'none', origin: [0, 0], keys: press }] }],
    };
  }
  return list;
}
