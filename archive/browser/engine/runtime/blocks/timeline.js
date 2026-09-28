import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Timeline — dated milestones along a line that fills as each one is spoken; optional "now" marker.',
  use: 'History, roadmaps, incident timelines. 3–6 milestones. Dates in the format your audience uses.',
  props: { items: "[{ date, label, sub, say }]", now: 'index of the current milestone (pulses)', kicker: '', title: '', source: '' },
  defaults: {},
  example: { vo: 'We piloted in January, rolled out to all teams in May, and hit the service target in September. Next: automation.', props: { title: 'The rollout', items: [{ date: 'Jan 2026', label: 'Pilot', say: 'piloted' }, { date: 'May 2026', label: 'All teams', say: 'rolled' }, { date: 'Sep 2026', label: 'Target met', say: 'hit' }, { date: 'Q1 2027', label: 'Automation', say: 'next' }], now: 2 } },
};
export const css = `
.b-tl .body { flex: 1; position: relative; }
.b-tl .track, .b-tl .fill { position: absolute; background: var(--line); }
.b-tl .fill { background: var(--accent); transform-origin: 0 50%; }
.b-tl .item { position: absolute; display: flex; flex-direction: column; gap: calc(12px * var(--u)); text-align: center; align-items: center; }
:root[data-format='vertical'] .b-tl .item { text-align: left; align-items: flex-start; }
.b-tl .dot { position: absolute; width: calc(26px * var(--u)); height: calc(26px * var(--u)); border-radius: 50%; background: var(--bg); border: calc(4px * var(--u)) solid var(--accent); }
.b-tl .pulse { position: absolute; width: calc(26px * var(--u)); height: calc(26px * var(--u)); border-radius: 50%; border: calc(3px * var(--u)) solid var(--accent); }
.b-tl .date { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--accent); letter-spacing: 0.04em; }
.b-tl .lab { font-size: calc(56px * var(--u)); font-weight: 620; letter-spacing: -0.03em; line-height: 1.05; }
.b-tl .sub { font-size: calc(28px * var(--u)); color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-tl">${head(p)}<div class="body blk-body"><div class="track"></div><div class="fill"></div>${(p.items ?? []).map((it) => `<div class="dot"></div><div class="item"><span class="date">${esc(it.date ?? '')}</span><span class="lab">${md(it.label)}</span>${it.sub ? `<span class="sub">${md(it.sub)}</span>` : ''}</div>`).join('')}</div></div>`;
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const body = el.querySelector('.body');
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const vertical = ctx.format === 'vertical';
  const W = body.offsetWidth, H = body.offsetHeight, n = (p.items ?? []).length;
  const track = el.querySelector('.track'), fill = el.querySelector('.fill');
  const dots = [...el.querySelectorAll('.dot')], items = [...el.querySelectorAll('.item')];
  const pos = (i) => (n === 1 ? 0.5 : vertical ? 0.04 + (0.8 * i) / (n - 1) : 0.04 + (0.92 * i) / (n - 1));
  const lw = 4 * uu, d = 26 * uu;
  if (vertical) {
    const x = 20 * uu;
    Object.assign(track.style, { left: `${x}px`, top: 0, width: `${lw}px`, height: `${H}px` });
    Object.assign(fill.style, { left: `${x}px`, top: 0, width: `${lw}px`, height: `${H}px`, transformOrigin: '50% 0', transform: 'scaleY(0)' });
    dots.forEach((dt, i) => Object.assign(dt.style, { left: `${x - d / 2 + lw / 2}px`, top: `${pos(i) * H - d / 2}px` }));
    items.forEach((it, i) => Object.assign(it.style, { left: `${x + 60 * uu}px`, top: `${pos(i) * H - 40 * uu}px` }));
  } else {
    const y = H * 0.45;
    Object.assign(track.style, { left: 0, top: `${y}px`, width: `${W}px`, height: `${lw}px` });
    Object.assign(fill.style, { left: 0, top: `${y}px`, width: `${W}px`, height: `${lw}px`, transform: 'scaleX(0)' });
    dots.forEach((dt, i) => Object.assign(dt.style, { left: `${pos(i) * W - d / 2}px`, top: `${y - d / 2 + lw / 2}px` }));
    items.forEach((it, i) => {
      Object.assign(it.style, { top: `${y + 50 * uu}px`, maxWidth: `${(W / n) * 0.95}px` });
      const w = it.offsetWidth;
      it.style.left = `${Math.min(W - w, Math.max(0, pos(i) * W - w / 2))}px`; // centred on the dot, never off-frame
    });
  }
  tl.from(track, { [vertical ? 'scaleY' : 'scaleX']: 0, transformOrigin: vertical ? '50% 0' : '0 50%', duration: 0.7, ease: 'power2.inOut' }, b.at(0.15));
  items.forEach((it, i) => {
    const t = itemTime(ctx, p.items[i], i, n, { from: 0.03, to: 0.8 });
    tl.to(fill, { [vertical ? 'scaleY' : 'scaleX']: pos(i), duration: 0.6, ease: 'power2.inOut' }, t - 0.35);
    tl.from(dots[i], { scale: 0, duration: 0.4, ease: 'back.out(2)' }, t);
    kit.enter(it, t + 0.05, { y: 14 });
    sound('tock', t + 0.05, { volume: 0.25 });
  });
  if (p.now != null && dots[p.now]) {
    const pulse = document.createElement('div');
    pulse.className = 'pulse';
    pulse.style.left = dots[p.now].style.left; pulse.style.top = dots[p.now].style.top;
    body.appendChild(pulse);
    const tNow = itemTime(ctx, p.items[p.now], p.now, n, { from: 0.03, to: 0.8 }) + 0.4;
    window.CF.onFrame((t) => { const k = t < tNow ? 0 : ((t - tNow) % 1.6) / 1.6; pulse.style.opacity = t < tNow ? 0 : (1 - k) * 0.8; pulse.style.transform = `scale(${1 + k * 1.6})`; });
  }
  finish(ctx);
}
