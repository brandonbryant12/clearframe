// Beats: calibrated → means → over. A hand-built SVG reliability diagram.
export const css = `
.cb { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); display: grid; grid-template-columns: calc(850px * var(--u)) 1fr; gap: calc(110px * var(--u)); align-items: center; }
.cb svg { overflow: visible; }
.cb svg text { font-family: var(--cf-mono); font-size: 25px; fill: var(--dim); }
.cb svg .axis-title { font-family: var(--cf-sans); font-size: 30px; fill: var(--ink-2); font-weight: 500; }
.cb .col { display: flex; flex-direction: column; gap: calc(22px * var(--u)); }
.cb .q { font-family: var(--cf-display); font-size: var(--t-h1); line-height: 1; letter-spacing: -0.015em; margin-bottom: calc(24px * var(--u)); }
.cb .lg { display: flex; align-items: center; gap: calc(22px * var(--u)); font-size: var(--t-label); color: var(--ink-2); }
.cb .sw { width: calc(56px * var(--u)); height: calc(4px * var(--u)); flex: none; }
.cb .sw.dash { background: repeating-linear-gradient(90deg, var(--ink-2) 0 calc(10px * var(--u)), transparent 0 calc(18px * var(--u))); }
.cb .sw.dot { width: calc(20px * var(--u)); height: calc(20px * var(--u)); border-radius: 50%; background: var(--ink); margin: 0 calc(18px * var(--u)); }
.cb .sw.rust { background: var(--down); }
`;

const S = 700, L = 110, TOP = 20; // plot size and offsets (px at 1080p)
export const html = `
<div class="cb">
  <svg class="plot" viewBox="0 0 ${L + S + 40} ${TOP + S + 90}"></svg>
  <div class="col">
    <div class="q">Does 70% mean 70%?</div>
    <div class="lg l1"><span class="sw dash"></span>Perfectly calibrated</div>
    <div class="lg l2"><span class="sw dot"></span>A calibrated forecaster</div>
    <div class="lg l3"><span class="sw rust"></span>An overconfident one</div>
  </div>
</div>`;

export default function ({ el, b, beat, kit, tl }) {
  el.dataset.until = 'over';
  const means = beat('means'), over = beat('over');
  const $ = (s) => el.querySelector(s);
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const svg = $('svg.plot');
  svg.setAttribute('width', (L + S + 40) * u);
  svg.setAttribute('height', (TOP + S + 90) * u);
  const NS = 'http://www.w3.org/2000/svg';
  const add = (tag, attrs, parent = svg) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
  const X = (p) => L + (p / 100) * S, Y = (p) => TOP + S - (p / 100) * S;

  // Axes + grid.
  const grid = [0, 25, 50, 75, 100].flatMap((p) => [
    add('line', { x1: X(0), x2: X(100), y1: Y(p), y2: Y(p), stroke: 'var(--line)', 'stroke-width': 1.5 }),
    add('line', { x1: X(p), x2: X(p), y1: Y(0), y2: Y(100), stroke: 'var(--line)', 'stroke-width': 1.5 }),
  ]);
  const labels = [0, 50, 100].flatMap((p) => {
    const a = add('text', { x: X(p), y: Y(0) + 38, 'text-anchor': 'middle' }); a.textContent = `${p}%`;
    const c = add('text', { x: X(0) - 16, y: Y(p) + 8, 'text-anchor': 'end' }); c.textContent = `${p}%`;
    return [a, c];
  });
  const xt = add('text', { x: X(50), y: Y(0) + 82, 'text-anchor': 'middle', class: 'axis-title' }); xt.textContent = 'Forecast said';
  const yt = add('text', { x: X(0) - 72, y: Y(50), 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 ${X(0) - 72} ${Y(50)})` }); yt.textContent = 'Actually happened';

  // Perfect-calibration diagonal (dashed) revealed through a growing clip.
  const clip = add('clipPath', { id: 'cb-clip' }, add('defs', {}));
  const clipRect = add('rect', { x: X(0) - 10, y: 0, width: 0, height: TOP + S + 20 }, clip);
  add('line', { x1: X(0), y1: Y(0), x2: X(100), y2: Y(100), stroke: 'var(--ink-2)', 'stroke-width': 3, 'stroke-dasharray': '10 9', 'clip-path': 'url(#cb-clip)' });

  // A calibrated forecaster: points hug the diagonal.
  const good = [[10, 11], [30, 28], [50, 52], [70, 69], [90, 88]];
  const dots = good.map(([p, q]) => add('circle', { cx: X(p), cy: Y(q), r: 12, fill: 'var(--ink)' }));
  const ring = add('circle', { cx: X(70), cy: Y(69), r: 24, fill: 'none', stroke: kit.color('--accent'), 'stroke-width': 4 });
  const call = add('text', { x: X(70) - 40, y: Y(69) - 44, 'text-anchor': 'end', style: 'fill: var(--accent); font-family: var(--cf-sans); font-weight: 650; font-size: 36px' });
  call.textContent = 'said 70 → happened 70';

  // An overconfident forecaster: says 90, gets 70.
  const bad = [[10, 18], [30, 34], [50, 48], [70, 58], [90, 70]];
  const d = bad.map(([p, q], i) => `${i ? 'L' : 'M'}${X(p)},${Y(q)}`).join(' ');
  const badPath = add('path', { d, fill: 'none', stroke: 'var(--down)', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const badDots = bad.map(([p, q]) => add('circle', { cx: X(p), cy: Y(q), r: 8, fill: 'var(--down)' }));

  // --- calibrated
  kit.reveal($('.q'), b.at(0.15), { by: 'words' });
  tl.from([...grid, ...labels, xt, yt], { opacity: 0, duration: 0.5, stagger: 0.015 }, b.at(0.1));
  tl.to(clipRect, { attr: { width: S + 20 }, duration: 1.1, ease: 'power2.inOut' }, b.say('calibrated') - 0.2);
  kit.enter($('.l1'), b.say('calibrated'), { y: 10 });

  // --- means
  tl.from(dots, { attr: { r: 0 }, duration: 0.45, stagger: 0.14, ease: 'back.out(2)' }, means.say('everything'));
  kit.enter($('.l2'), means.say('everything'), { y: 10 });
  tl.from(ring, { attr: { r: 0 }, opacity: 0, duration: 0.5, ease: 'back.out(1.6)' }, means.say('seventy', { nth: 1 }));
  tl.from(call, { opacity: 0, y: 10, duration: 0.5 }, means.say('seventy', { nth: 1 }) + 0.1);

  // --- over
  tl.to([ring, call], { opacity: 0, duration: 0.3 }, over.at(0));
  tl.to(dots, { opacity: 0.35, duration: 0.4 }, over.at(0));
  kit.draw(badPath, over.say('overconfident') - 0.1, { dur: 0.9 });
  tl.from(badDots, { attr: { r: 0 }, duration: 0.35, stagger: 0.1, ease: 'back.out(2)' }, over.say('overconfident'));
  kit.enter($('.l3'), over.say('overconfident'), { y: 10 });
  tl.to([$('.l1'), $('.l2')], { opacity: 0.45, duration: 0.4 }, over.say('sag'));
}
