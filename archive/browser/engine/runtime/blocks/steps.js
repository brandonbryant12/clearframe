import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Process steps — numbered cards joined by connectors; each lands on its spoken word, the current one highlighted.',
  use: 'How-tos and pipelines with 3–5 stages. Name steps with verbs. Icons optional (Lucide names).',
  props: { items: "[{ label, sub, icon, say }]", active: "'each' (highlight the step being spoken) | 'none'", kicker: '', title: '', source: '' },
  defaults: { active: 'each' },
  example: { vo: 'Write the forecast, check it against what happened, then adjust the plan.', props: { title: 'The forecasting loop', items: [{ label: 'Forecast', sub: 'State a probability', icon: 'target', say: 'write' }, { label: 'Check', sub: 'Compare with outcomes', icon: 'list-checks', say: 'check' }, { label: 'Adjust', sub: 'Re-plan the risk', icon: 'sliders-horizontal', say: 'adjust' }] } },
};
export const css = `
.b-steps .row { flex: 1; display: flex; align-items: center; justify-content: center; }
:root[data-format='vertical'] .b-steps .row { flex-direction: column; }
.b-steps .card { position: relative; padding: calc(40px * var(--u)) calc(40px * var(--u)) calc(36px * var(--u)); width: var(--card-w, calc(460px * var(--u))); display: flex; flex-direction: column; gap: calc(16px * var(--u)); }
:root[data-format='vertical'] .b-steps .card { width: 100%; flex-direction: row; align-items: center; gap: calc(28px * var(--u)); padding: calc(28px * var(--u)) calc(32px * var(--u)); }
.b-steps .top { display: flex; align-items: center; justify-content: space-between; }
.b-steps .num { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--dim); }
.b-steps .ic { color: var(--accent); }
.b-steps .lab { font-size: calc(64px * var(--u)); font-weight: 620; letter-spacing: -0.03em; line-height: 1.05; }
.b-steps .sub { font-size: calc(34px * var(--u)); color: var(--ink-2); line-height: 1.3; }
.b-steps .conn { flex: none; width: calc(90px * var(--u)); height: calc(3px * var(--u)); background: var(--line); transform-origin: 0 50%; position: relative; }
.b-steps .conn::after { content: ''; position: absolute; right: calc(-2px * var(--u)); top: 50%; width: calc(14px * var(--u)); height: calc(14px * var(--u)); border-top: calc(3px * var(--u)) solid var(--line); border-right: calc(3px * var(--u)) solid var(--line); transform: translateY(-50%) rotate(45deg); }
:root[data-format='vertical'] .b-steps .conn { width: calc(3px * var(--u)); height: calc(46px * var(--u)); transform-origin: 50% 0; }
:root[data-format='vertical'] .b-steps .conn::after { right: auto; left: 50%; top: auto; bottom: calc(-2px * var(--u)); transform: translateX(-50%) rotate(135deg); }
`;
export const html = (p) => `<div class="blk b-steps">${head(p)}<div class="row">${(p.items ?? []).map((it, i) => `${i ? '<div class="conn"></div>' : ''}<div class="card blk-card"><div class="top"><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="ic"></span></div><div><div class="lab">${md(it.label)}</div>${it.sub ? `<div class="sub">${md(it.sub)}</div>` : ''}</div></div>`).join('')}</div></div>`;
export default async function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const cards = [...el.querySelectorAll('.card')], conns = [...el.querySelectorAll('.conn')];
  const vertical = ctx.format === 'vertical';
  if (!vertical) { // fit n cards + connectors across the safe width
    const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
    const avail = el.querySelector('.row').offsetWidth - conns.length * 90 * uu;
    el.querySelector('.row').style.setProperty('--card-w', `${Math.min(520 * uu, avail / Math.max(1, cards.length))}px`);
  }
  const times = cards.map((_, i) => itemTime(ctx, p.items[i], i, cards.length, { from: 0.02, to: 0.75 }));
  for (const [i, card] of cards.entries()) {
    const it = p.items[i], t = times[i];
    if (i) tl.from(conns[i - 1], { [vertical ? 'scaleY' : 'scaleX']: 0, duration: 0.35, ease: 'power2.inOut' }, t - 0.3);
    kit.enter(card, t, { y: 20 });
    if (it.icon) kit.drawIcon(await kit.icon(card.querySelector('.ic'), it.icon, { size: 64, stroke: 1.6 }), t + 0.15, { dur: 0.6 });
    sound('tock', t + 0.05, { volume: 0.3 });
    if (p.active === 'each') {
      tl.to(card, { borderColor: kit.color('--accent'), duration: 0.3 }, t);
      if (i < cards.length - 1) tl.to(card, { borderColor: kit.color('--line'), duration: 0.3 }, times[i + 1]);
    }
  }
  finish(ctx, { driftTarget: el.querySelector('.row') });
}
