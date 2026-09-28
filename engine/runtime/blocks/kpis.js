import { head, animateHead, finish, itemTime, esc, decimalsOf } from './_lib.js';
export const meta = {
  tail: 1.5, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'KPI tiles — 2–4 numbers side by side, each counting up with a delta chip.',
  use: 'Status updates and dashboards-in-motion. Name each metric plainly; never more than 4.',
  props: { items: "[{ value, prefix, suffix, decimals, label, delta, dir, good, deltaLabel, say }]", kicker: '', title: '', source: '' },
  defaults: {},
  example: { vo: 'Quarter in review: requests up to twelve thousand four hundred, first response down to four hours, and satisfaction at ninety-one percent.', props: { kicker: 'Q3 in review', title: 'Service desk, at a glance', items: [{ label: 'Requests', value: 12400, delta: '+8%', dir: 'up', good: 'up', say: 'requests' }, { label: 'First response', value: 4.0, suffix: ' h', delta: '−2.1 h', dir: 'down', good: 'down', say: 'response' }, { label: 'Satisfaction', value: 91, suffix: '%', delta: '+3 pts', dir: 'up', say: 'satisfaction' }], source: 'Sample data' } },
};
export const css = `
.b-kpis .grid { flex: 1; display: grid; gap: calc(28px * var(--u)); align-content: center; }
.b-kpis .tile { padding: calc(40px * var(--u)) calc(40px * var(--u)) calc(36px * var(--u)); display: flex; flex-direction: column; gap: calc(18px * var(--u)); }
.b-kpis .v { font-size: calc(140px * var(--u)); line-height: 0.9; letter-spacing: -0.05em; white-space: nowrap; }
.b-kpis .v .sfx { font-size: 0.45em; color: var(--ink-2); letter-spacing: -0.02em; margin-left: 0.05em; }
:root[data-format='vertical'] .b-kpis .v { font-size: calc(104px * var(--u)); }
.b-kpis .cf-chip { align-self: flex-start; }
`;
export function html(p, ctx) {
  const n = (p.items ?? []).length;
  const cols = ctx.format === 'vertical' ? 1 : Math.min(n, 4);
  return `<div class="blk b-kpis">${head(p)}<div class="grid" style="grid-template-columns: repeat(${cols}, 1fr)">${(p.items ?? []).map((it) => `<div class="tile blk-card"><div class="cf-kicker">${esc(it.label ?? '')}</div><div class="v cf-num"></div><div class="cw"></div></div>`).join('')}</div></div>`;
}
export default function (ctx) {
  const { el, b, kit, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const tiles = [...el.querySelectorAll('.tile')];
  tiles.forEach((tile, i) => {
    const it = p.items[i];
    const t = itemTime(ctx, it, i, tiles.length, { from: 0.02, to: 0.7 });
    const long = it.suffix && it.suffix.trim().length > 1;
    kit.enter(tile, t - 0.1, { y: 22 });
    const v = tile.querySelector('.v');
    kit.counter(v, t, { from: it.from ?? 0, to: it.value, decimals: it.decimals ?? decimalsOf(it.value), prefix: it.prefix ?? '', suffix: long ? '' : it.suffix ?? '', dur: 1.1 });
    if (long) v.insertAdjacentHTML('beforeend', `<span class="sfx">${esc(it.suffix)}</span>`);
    if (it.delta) kit.enter(kit.chip(tile.querySelector('.cw'), it.delta, { dir: it.dir ?? 'up', good: it.good ?? 'up', label: it.deltaLabel }), t + 0.8, { y: 8 });
    sound('tick', t + 1.05, { volume: 0.3 });
  });
  finish(ctx, { driftTarget: el.querySelector('.grid') });
}
