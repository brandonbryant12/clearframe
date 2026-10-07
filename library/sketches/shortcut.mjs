import { tall, round } from '../../film/sketch-kit.mjs';

// Faster by taking fewer steps, not by a number: a request (a person) and its result (a check)
// are joined by an old winding route that stops at four waits (clocks). On SHORTCUT a straight new
// route draws across. On GO two tokens leave together at the same speed, one on each route, and the
// one on the new route arrives first simply because its way is shorter; on ARRIVE the finish
// lights. Speeds are equal, so the picture claims fewer steps, never a measured speed-up.
const AT = { SHORTCUT: 1.0, GO: 2.2, ARRIVE: 4.4 };
const SPEED = 900; // px per second, the same for both tokens

function layout(w, h) {
  if (tall(w, h))
    return { start: [540, 420], end: [540, 1600], stops: [[250, 650], [830, 900], [250, 1150], [830, 1400]], oldTag: [120, 300], newTag: [600, 560], size: 44, r: 70 };
  return { start: [220, 540], end: [1700, 540], stops: [[520, 260], [860, 820], [1200, 260], [1500, 820]], oldTag: [400, 170], newTag: [960, 500], size: 40, r: 66 };
}
const length = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

export default {
  name: 'shortcut',
  order: 74,
  summary:
    'Faster by taking fewer steps: an old winding route through four waits and a new straight one; two tokens leave together at the same speed and the one on the new route arrives first.',
  use: 'Speed and efficiency without inventing a figure: fewer steps, fewer handoffs, a direct path, "we cut out the waiting". Works on light and dark palettes. Replace OLD and NEW (the route labels) with sketchText; land SHORTCUT, GO and ARRIVE on words with sketchSay. Add a sourced stat beat if you have a measured number.',
  build(w, h) {
    const L = layout(w, h),
      T = tall(w, h);
    const winding = [L.start, ...L.stops, L.end],
      straight = [L.start, L.end];
    const d = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
    // The old route as a smooth curve through its stops; its length is measured along the curve
    // (sampled), so the two tokens' speeds really are equal.
    const segs = winding.slice(1).map(([x, y], i) => {
      const [px, py] = winding[i];
      return T ? [[px, py], [px, (py + y) / 2], [x, (py + y) / 2], [x, y]] : [[px, py], [(px + x) / 2, py], [(px + x) / 2, y], [x, y]];
    });
    const curve = segs.map(([a, b, c, e], i) => `${i ? '' : `M ${a[0]} ${a[1]} `}C ${round(b[0])} ${round(b[1])} ${round(c[0])} ${round(c[1])} ${e[0]} ${e[1]}`).join(' ');
    const bez = ([a, b, c, e], t) => [0, 1].map(k => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t ** 2 * c[k] + t ** 3 * e[k]);
    const curveLength = segs.reduce((sum, seg) => sum + length(Array.from({ length: 33 }, (_, i) => bez(seg, i / 32))), 0);
    const node = ([x, y], icon, fill, extra = {}) => ({
      type: 'group', enter: 'pop', at: 0.1, dur: 0.4, ...extra,
      children: [
        { type: 'circle', cx: x, cy: y, r: L.r, fill, stroke: 'ink', width: 4 },
        { type: 'icon', name: icon, x, y, size: L.r, fill: fill === 'accent' ? 'bg' : 'ink' },
      ],
    });
    // Both tokens travel at SPEED, so each route's length alone sets when it arrives.
    const token = (fill, path, len, extra = {}) => ({
      type: 'circle', cx: L.start[0], cy: L.start[1], r: 26, fill, stroke: 'bg', width: 5, enter: 'pop', cue: 'GO', at: AT.GO, dur: 0.2, ...extra,
      along: { d: path, cue: 'GO', at: AT.GO, dur: round(len / SPEED), ease: 'linear' },
      // A short trail behind each token, so the race reads as motion even at a glance.
      echo: { count: 6, lag: 0.05 },
    });
    return {
      elements: [
        { type: 'path', d: curve, fill: 'none', stroke: 'muted', width: 6, dash: [16, 12], enter: 'draw', at: 0, dur: 1.2 },
        // Each stop on the old route is a wait.
        ...L.stops.map(([x, y], i) => ({ type: 'group', enter: 'pop', at: 0.3 + i * 0.15, dur: 0.3, children: [
          { type: 'circle', cx: x, cy: y, r: round(L.r * 0.7), fill: 'surface', stroke: 'muted', width: 4, loop: { type: 'pulse', period: 1.4 + i * 0.2 } },
          { type: 'icon', name: 'clock', x, y, size: round(L.r * 0.7), fill: 'muted' },
        ] })),
        { type: 'path', d: d(straight), fill: 'none', stroke: 'accent', width: 10, cap: 'round', enter: 'draw', cue: 'SHORTCUT', at: AT.SHORTCUT, dur: 0.8 },
        // The two ends stand from the first frame, so a cut into this beat is never empty.
        node(L.start, 'user', 'surface', { enter: 'none', at: 0 }),
        node(L.end, 'check', 'surface', { enter: 'none', at: 0 }),
        // The finish lights when the first token arrives.
        node(L.end, 'check', 'accent', { enter: 'pop', cue: 'ARRIVE', at: AT.ARRIVE, dur: 0.35 }),
        token('muted', curve, curveLength),
        token('accent2', d(straight), length(straight), { exit: 'fade', exitCue: 'ARRIVE', exitAt: AT.ARRIVE, exitDur: 0.3 }),
        { type: 'text', text: 'OLD', x: L.oldTag[0], y: L.oldTag[1], size: L.size, font: 'semibold', fill: 'muted', enter: 'fade', at: 0.6, dur: 0.5 },
        { type: 'text', text: 'NEW', x: L.newTag[0], y: L.newTag[1], size: L.size, font: 'semibold', fill: 'accent', anchor: T ? 'start' : 'middle', enter: 'fade', cue: 'SHORTCUT', at: AT.SHORTCUT, dur: 0.5 },
      ],
    };
  },
};
