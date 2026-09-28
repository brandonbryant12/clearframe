import { head, animateHead, finish, itemTime, esc, md, tone } from './_lib.js';
export const meta = {
  tail: 1.4, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Unit chart — a 10×10 grid that makes a share countable ("7 in 10"), with counters beside it.',
  use: 'Probabilities, shares, risks. Countable beats abstract: prefer this to a pie or a lone percentage.',
  props: { total: '100', cols: '10', parts: "[{ n, label, tone: 'ink'|'accent'|'down'|'dim', say }] filled in order", kicker: '', title: '', source: '', order: "'rows' | 'random' | 'center'" },
  defaults: { total: 100, cols: 10, order: 'rows' },
  example: { vo: 'Picture a hundred launches with the same forecast. About seventy ship on time. About thirty slip.', props: { kicker: '100 launches · same 70% forecast', parts: [{ n: 70, label: 'ship on time', tone: 'ink', say: 'seventy' }, { n: 30, label: 'slip', tone: 'accent', say: 'thirty' }] } },
};
export const css = `
.b-waffle .wrap { flex: 1; display: grid; grid-template-columns: auto 1fr; gap: calc(120px * var(--u)); align-items: center; }
:root[data-format='vertical'] .b-waffle .wrap { grid-template-columns: 1fr; grid-template-rows: auto auto; gap: calc(60px * var(--u)); justify-items: center; align-content: center; }
.b-waffle .grid { width: calc(640px * var(--u)); height: calc(640px * var(--u)); }
:root[data-format='vertical'] .b-waffle .grid { width: calc(760px * var(--u)); height: calc(760px * var(--u)); }
.b-waffle .stats { display: flex; flex-direction: column; gap: calc(28px * var(--u)); }
:root[data-format='vertical'] .b-waffle .stats { flex-direction: row; gap: calc(60px * var(--u)); }
.b-waffle .stat { display: flex; align-items: baseline; gap: calc(24px * var(--u)); }
.b-waffle .stat .v { font-size: calc(170px * var(--u)); line-height: 0.9; letter-spacing: -0.05em; min-width: 2ch; }
:root[data-format='vertical'] .b-waffle .stat .v { font-size: calc(130px * var(--u)); }
.b-waffle .stat .l { font-size: var(--t-h3); color: var(--ink-2); letter-spacing: -0.02em; }
.b-waffle .head2 { margin-bottom: calc(10px * var(--u)); }
`;
export function html(p, ctx) {
  const v = ctx.format === 'vertical';
  const stats = (p.parts ?? []).map((pt) => `<div class="stat"><span class="v cf-num" style="color:${tone(pt.tone, 'var(--ink)')}">0</span><span class="l">${md(pt.label ?? '')}</span></div>`).join('');
  return `<div class="blk b-waffle">${v ? head(p) : ''}<div class="wrap"><div class="grid"></div><div class="col">${v ? '' : `<div class="head2">${head(p)}</div>`}<div class="stats">${stats}</div></div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const grid = kit.waffle(el.querySelector('.grid'), { total: p.total, cols: p.cols, color: 'var(--line)' });
  grid.show(b.at(0.15), { from: 'center', each: 0.006 });
  let start = 0;
  const stats = [...el.querySelectorAll('.stat')];
  (p.parts ?? []).forEach((pt, i) => {
    const t = itemTime(ctx, pt, i, p.parts.length, { from: 0.25, to: 0.75 });
    grid.fill(pt.n, t, { color: tone(pt.tone, 'var(--ink)'), order: p.order, start, each: Math.min(0.02, 0.9 / Math.max(1, pt.n)) });
    start += pt.n;
    kit.enter(stats[i], t - 0.1, { y: 14 });
    kit.counter(stats[i].querySelector('.v'), t, { to: pt.n, dur: 0.9 });
    sound('tock', t + 0.85, { volume: 0.3 });
  });
  finish(ctx, { driftTarget: el.querySelector('.wrap') });
}
