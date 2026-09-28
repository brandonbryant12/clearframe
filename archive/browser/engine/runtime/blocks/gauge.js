import { head, animateHead, finish, formatter, md } from './_lib.js';
export const meta = {
  tail: 1.8, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Gauge — a semicircular scale with labelled zones; the needle swings to the value.',
  use: 'Scores and health indices with meaningful bands ("at risk / healthy"). Label the zones.',
  props: { value: 'number', min: '0', max: '100', zones: "[{ to, label, tone: 'down'|'dim'|'up'|'accent' }]", label: 'what is measured', format: "{ suffix } or '%'", land: 'spoken word', kicker: '', title: '', source: '' },
  defaults: { min: 0, max: 100 },
  example: { vo: 'Our delivery confidence score now sits at seventy-four — in the healthy band, but only just.', props: { kicker: 'Delivery confidence', value: 74, zones: [{ to: 50, label: 'At risk', tone: 'down' }, { to: 70, label: 'Watch', tone: 'dim' }, { to: 100, label: 'Healthy', tone: 'up' }], label: 'Healthy — *but only just*', land: 'seventy' } },
};
const TONE = { down: 'var(--down)', up: 'var(--up)', dim: 'var(--dim)', accent: 'var(--accent)', ink: 'var(--ink)' };
export const css = `
.b-gauge .wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.b-gauge svg { overflow: visible; }
.b-gauge svg text { font-family: var(--cf-mono); fill: var(--dim); }
.b-gauge .v { font-size: calc(150px * var(--u)); letter-spacing: -0.05em; line-height: 1; margin-top: calc(24px * var(--u)); }
.b-gauge .l { margin-top: calc(18px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-gauge">${head(p)}<div class="wrap"><svg class="g"></svg><div class="v cf-num"></div>${p.label ? `<div class="l">${md(p.label)}</div>` : ''}</div></div>`;
export default function (ctx) {
  const { el, b, kit, tl, cue, format, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const avail = el.querySelector('.wrap').offsetWidth;
  const R = Math.min(360 * uu, (avail - 300 * uu) / 2), sw = 28 * uu, W = 2 * R + 200 * uu, H = R + 80 * uu, cx = W / 2, cy = R + 40 * uu;
  const svg = el.querySelector('svg.g');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const NS = 'http://www.w3.org/2000/svg';
  const add = (tag, a) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); svg.appendChild(n); return n; };
  const ang = (v) => Math.PI + ((v - p.min) / (p.max - p.min)) * Math.PI;
  const pt = (v, r) => [cx + r * Math.cos(ang(v)), cy + r * Math.sin(ang(v))];
  const arc = (a, z, r) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(z, r); return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`; };
  const zones = p.zones ?? [{ to: p.max, tone: 'accent' }];
  let from = p.min;
  const arcs = [], labels = [];
  const gap = (p.max - p.min) * 0.006;
  for (const z of zones) {
    arcs.push(add('path', { d: arc(from + gap, z.to - gap, R), fill: 'none', stroke: TONE[z.tone] ?? z.tone ?? 'var(--line)', 'stroke-width': sw, 'stroke-linecap': 'butt', opacity: 0.9 }));
    if (z.label) {
      const [x, y] = pt((from + z.to) / 2, R + 44 * uu);
      const anchor = x > cx + 30 * uu ? 'start' : x < cx - 30 * uu ? 'end' : 'middle'; // keep labels off the arc
      const t = add('text', { x, y, 'text-anchor': anchor, 'font-size': 24 * uu }); t.textContent = z.label.toUpperCase(); labels.push(t);
    }
    from = z.to;
  }
  for (const v of [p.min, p.max]) { const [x, y] = pt(v, R - 56 * uu); const t = add('text', { x, y: y + 8 * uu, 'text-anchor': 'middle', 'font-size': 24 * uu }); t.textContent = v; labels.push(t); }
  const needle = add('path', { d: `M${cx - R * 0.82},${cy} L${cx},${cy - 9 * uu} L${cx},${cy + 9 * uu} Z`, fill: 'var(--ink)' });
  const hub = add('circle', { cx, cy, r: 22 * uu, fill: 'var(--ink)' });
  const t0 = b.at(0.2), t = cue(p.land, 0.8);
  arcs.forEach((a, i) => kit.draw(a, t0 + i * 0.15, { dur: 0.6 }));
  tl.from(labels, { opacity: 0, duration: 0.4, stagger: 0.05 }, t0 + 0.4);
  tl.from([needle, hub], { opacity: 0, duration: 0.3 }, t0 + 0.3);
  const deg = ((p.value - p.min) / (p.max - p.min)) * 180;
  tl.fromTo(needle, { rotation: 0, svgOrigin: `${cx} ${cy}` }, { rotation: deg, svgOrigin: `${cx} ${cy}`, duration: 1.5, ease: 'back.out(1.1)', immediateRender: true }, t);
  const fmt = formatter(p.format, 0);
  kit.counter(el.querySelector('.v'), t, { from: p.min, to: p.value, format: fmt, dur: 1.4 });
  const l = el.querySelector('.l');
  if (l) kit.enter(l, t + 1.1, { y: 10 });
  sound('tick', t + 1.4, { volume: 0.35 });
  finish(ctx, { driftTarget: el.querySelector('.wrap') });
}
