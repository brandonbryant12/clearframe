import { head, animateHead, finish, esc, md } from './_lib.js';
export const meta = {
  tail: 1.5, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Ring — a single proportion as a donut that sweeps to its value, the number in the middle.',
  use: 'One share or completion rate. For several parts use share or waffle.',
  props: { value: '0–1, or 0–max', max: '1 (or 100)', label: 'what the ring measures', sub: 'supporting line', land: 'spoken word', decimals: '0', kicker: '', title: '', source: '' },
  defaults: { max: 1, decimals: 0 },
  example: { vo: 'Eighty-two percent of incidents were resolved inside the target window.', props: { value: 0.82, label: 'of incidents resolved within target', sub: 'Up from 64% a year ago', land: 'eighty', kicker: 'Resolution rate', source: 'Incident log, Jan–Sep 2026 (sample data)' } },
};
export const css = `
.b-ring .wrap { flex: 1; display: grid; grid-template-columns: auto 1fr; gap: calc(110px * var(--u)); align-items: center; }
:root[data-format='vertical'] .b-ring .wrap { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: calc(60px * var(--u)); align-content: center; }
.b-ring .dial { position: relative; width: calc(600px * var(--u)); height: calc(600px * var(--u)); }
.b-ring .center { position: absolute; inset: 0; display: grid; place-items: center; }
.b-ring .center .v { font-size: calc(170px * var(--u)); letter-spacing: -0.05em; }
.b-ring .l { font-family: var(--cf-display); font-size: calc(88px * var(--u)); line-height: 1.02; letter-spacing: -0.015em; max-width: 14ch; }
.b-ring .s { margin-top: calc(24px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-ring"><div class="wrap"><div class="dial"><div class="center"><span class="v cf-num">0%</span></div></div><div class="txt">${head(p)}${p.label ? `<div class="l">${md(p.label)}</div>` : ''}${p.sub ? `<div class="s">${md(p.sub)}</div>` : ''}</div></div></div>`;
export default function (ctx) {
  const { el, b, kit, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const frac = p.value / p.max;
  const t = cue(p.land, 0.5);
  const ring = kit.donut(el.querySelector('.dial'), { thickness: 0.09 });
  el.querySelector('.dial').appendChild(el.querySelector('.center'));
  kit.enter(el.querySelector('.dial'), b.at(0.1), { y: 0, scale: 0.96 });
  ring.sweep(t, { to: frac, dur: 1.3 });
  kit.counter(el.querySelector('.center .v'), t, { to: frac * 100, decimals: p.decimals, suffix: '%', dur: 1.3 });
  const l = el.querySelector('.l'), s = el.querySelector('.s');
  if (l) kit.reveal(l, t + 0.2, { by: 'words' });
  if (s) kit.enter(s, t + 0.9, { y: 10 });
  sound('tick', t + 1.3, { volume: 0.35 });
  finish(ctx, { driftTarget: el.querySelector('.wrap') });
}
