import { head, animateHead, finish, esc, md, decimalsOf } from './_lib.js';
export const meta = {
  tail: 1.8, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Before → after — two numbers, an arrow that draws between them, and the change as a chip.',
  use: 'Improvements and regressions: "4.2 s → 1.1 s". State the period for both.',
  props: { from: '{ value, label }', to: '{ value, label }', prefix: '', suffix: '', decimals: '', change: "override text, e.g. '−74%' (auto % if omitted)", better: "'down' | 'up' — which direction is good", fromSay: 'word for the old value', toSay: 'word for the new value', kicker: '', title: '', source: '' },
  defaults: { better: 'up' },
  example: { vo: 'Page load went from four point two seconds to one point one.', props: { kicker: 'Checkout page load', from: { value: 4.2, label: 'Before · March' }, to: { value: 1.1, label: 'After · September' }, suffix: ' s', better: 'down', fromSay: 'four', toSay: 'one', source: 'Synthetic monitoring, p50 (sample data)' } },
};
export const css = `
.b-delta .row { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: calc(40px * var(--u)); }
:root[data-format='vertical'] .b-delta .row { grid-template-columns: 1fr; grid-template-rows: auto auto auto; justify-items: center; text-align: center; }
.b-delta .side { display: flex; flex-direction: column; gap: calc(18px * var(--u)); }
.b-delta .side.to { align-items: flex-end; text-align: right; }
:root[data-format='vertical'] .b-delta .side, :root[data-format='vertical'] .b-delta .side.to { align-items: center; text-align: center; }
.b-delta .n { font-size: calc(200px * var(--u)); line-height: 0.88; letter-spacing: -0.05em; white-space: nowrap; }
.b-delta .from .n { color: var(--ink-2); }
.b-delta .l { font-size: var(--t-label); color: var(--dim); font-family: var(--cf-mono); letter-spacing: 0.04em; }
.b-delta .mid { display: flex; flex-direction: column; align-items: center; gap: calc(22px * var(--u)); }
.b-delta svg { overflow: visible; }
`;
export function html(p, ctx) {
  const v = ctx.format === 'vertical';
  const arrow = v
    ? `<svg width="${60}" height="${150}" viewBox="0 0 60 150"><path class="shaft" d="M30 6 L30 140" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none"/><path class="head" d="M12 120 L30 142 L48 120" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`
    : `<svg width="${260}" height="${60}" viewBox="0 0 260 60"><path class="shaft" d="M6 30 L248 30" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none"/><path class="head" d="M226 12 L250 30 L226 48" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  return `<div class="blk b-delta">${head(p)}<div class="row"><div class="side from"><div class="n cf-num"></div><div class="l">${esc(p.from?.label ?? '')}</div></div><div class="mid">${arrow}<div class="cw"></div></div><div class="side to"><div class="n cf-num"></div><div class="l">${esc(p.to?.label ?? '')}</div></div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const a = p.from.value, z = p.to.value;
  const dec = p.decimals ?? Math.max(decimalsOf(a), decimalsOf(z));
  const f = (v) => kit.fmt(v, { decimals: dec, prefix: p.prefix ?? '', suffix: p.suffix ?? '' });
  const [nFrom, nTo] = el.querySelectorAll('.n');
  nFrom.textContent = f(a);
  const t1 = cue(p.fromSay, 0.3), t2 = cue(p.toSay, () => t1 + 1.4);
  kit.enter(el.querySelector('.from'), t1, { y: 18 });
  kit.draw(el.querySelector('.shaft'), t2 - 0.55, { dur: 0.5 });
  kit.draw(el.querySelector('.head'), t2 - 0.1, { dur: 0.25 });
  kit.enter(el.querySelector('.to'), t2 - 0.1, { y: 18 });
  kit.counter(nTo, t2, { from: a, to: z, decimals: dec, prefix: p.prefix ?? '', suffix: p.suffix ?? '', dur: 1.0 });
  const pct = a ? ((z - a) / Math.abs(a)) * 100 : 0;
  const change = p.change ?? `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
  const dir = z > a ? 'up' : z < a ? 'down' : 'flat';
  kit.enter(kit.chip(el.querySelector('.cw'), change.replace(/^[+−-]/, (m) => m), { dir, good: p.better }), t2 + 0.9, { y: 8 });
  sound('tick', t2 + 0.95, { volume: 0.35 });
  finish(ctx, { driftTarget: el.querySelector('.row') });
}
