import { head, animateHead, finish, formatter, esc, md } from './_lib.js';
export const meta = {
  tail: 1.5, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Distribution — a dot histogram: every value is a dot, stacked in bins; a marker line and an optional highlighted range.',
  use: 'When the spread matters more than the average ("most tickets close in a day — but look at the tail").',
  props: { values: 'array of numbers (20–300)', bins: 'auto', min: '', max: '', unit: "axis unit, e.g. 'days'", marker: '{ value, label, say } (e.g. median)', highlight: '{ from, to, label, say } — dots in range turn accent', kicker: '', title: '', source: '' },
  defaults: {},
  example: { vo: 'Most requests close within two days. But one in ten takes more than a week — that tail is where customers churn.', props: { title: 'Days to close a request', values: 'demo', unit: 'days', marker: { value: 1.8, label: 'median 1.8 days', say: 'most' }, highlight: { from: 7, to: 20, label: '1 in 10 takes > 7 days', say: 'tail' }, source: 'Sample data' } },
};
export const css = `
.b-dist .body { flex: 1; position: relative; }
.b-dist svg { overflow: visible; position: absolute; inset: 0; }
.b-dist svg text { font-family: var(--cf-mono); fill: var(--dim); }
`;
export const html = (p) => `<div class="blk b-dist">${head(p)}<div class="body blk-body"><svg></svg></div></div>`;
function demo() { const r = window.CF.rand('dist'); return Array.from({ length: 150 }, () => (r() < 0.9 ? 0.3 + (r() + r() + r()) * 1.4 : 7.2 + r() * 5)); }
export default function (ctx) {
  const { el, b, kit, tl, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const values = p.values === 'demo' || !p.values ? demo() : p.values;
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const body = el.querySelector('.body');
  const W = body.offsetWidth, H = body.offsetHeight, padB = 70 * uu, padT = 80 * uu;
  const lo = p.min ?? Math.min(0, Math.floor(Math.min(...values))), hi = p.max ?? Math.ceil(Math.max(...values));
  const bins = p.bins ?? Math.min(40, Math.max(14, Math.round((hi - lo) * 2.5)));
  const bw = W / bins;
  const counts = new Array(bins).fill(0);
  const binOf = (v) => Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
  const sorted = [...values].sort((a, z) => a - z);
  const maxStack = Math.max(...sorted.reduce((c, v) => { c[binOf(v)]++; return c; }, new Array(bins).fill(0)));
  const d = Math.min(bw * 0.8, (H - padB - padT) / maxStack * 0.86);
  const svg = body.querySelector('svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  const NS = 'http://www.w3.org/2000/svg';
  const add = (tag, a) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); svg.appendChild(n); return n; };
  const X = (v) => ((v - lo) / (hi - lo)) * W, base = H - padB;
  const hl = p.highlight;
  let band = null;
  if (hl) band = add('rect', { x: X(hl.from), y: padT - 20 * uu, width: X(Math.min(hi, hl.to)) - X(hl.from), height: base - padT + 20 * uu, fill: 'var(--accent)', opacity: 0.08 });
  add('line', { x1: 0, x2: W, y1: base, y2: base, stroke: 'var(--line)', 'stroke-width': 2 });
  const ticks = [lo, (lo + hi) / 2, hi].map((v, i) => { const t = add('text', { x: X(v), y: base + 44 * uu, 'text-anchor': ['start', 'middle', 'end'][i], 'font-size': 24 * uu }); t.textContent = `${Math.round(v)}${p.unit ? ` ${p.unit}` : ''}`; return t; });
  const dots = sorted.map((v) => { const i = binOf(v); const k = counts[i]++; return { v, el: add('circle', { cx: i * bw + bw / 2, cy: base - d / 2 - k * d * 1.08, r: d / 2, fill: 'var(--ink-2)' }) }; });
  const t0 = b.at(0.3);
  tl.from(ticks, { opacity: 0, duration: 0.4 }, t0);
  tl.from(dots.map((x) => x.el), { attr: { cy: -20 }, opacity: 0, duration: 0.5, ease: 'power2.out', stagger: Math.min(0.012, 1.4 / dots.length) }, t0 + 0.1);
  if (p.marker) {
    const t = cue(p.marker.say, () => t0 + 1.8);
    const x = X(p.marker.value);
    const ln = add('line', { x1: x, x2: x, y1: base, y2: padT - 30 * uu, stroke: 'var(--ink)', 'stroke-width': 3, 'stroke-dasharray': '6 6' });
    const lb = add('text', { x: x + 14 * uu, y: padT - 36 * uu, 'font-size': 28 * uu, style: 'fill: var(--ink); font-family: var(--cf-sans); font-weight: 600' }); lb.textContent = p.marker.label ?? '';
    tl.from(ln, { attr: { y2: base }, duration: 0.6, ease: 'power3.out' }, t);
    tl.from(lb, { opacity: 0, duration: 0.4 }, t + 0.3);
    sound('tick', t + 0.2, { volume: 0.3 });
  }
  if (hl) {
    const t = cue(hl.say, () => t0 + 2.6);
    tl.from(band, { opacity: 0, duration: 0.5 }, t);
    tl.to(dots.filter((x) => x.v >= hl.from && x.v <= hl.to).map((x) => x.el), { attr: { fill: kit.color('--accent') }, duration: 0.4, stagger: 0.01 }, t);
    if (hl.label) { const lb = add('text', { x: X(hl.from) + 14 * uu, y: padT + 10 * uu, 'font-size': 30 * uu, style: 'fill: var(--accent); font-family: var(--cf-sans); font-weight: 650' }); lb.textContent = hl.label; tl.from(lb, { opacity: 0, y: 10, duration: 0.4 }, t + 0.2); }
  }
  finish(ctx);
}
