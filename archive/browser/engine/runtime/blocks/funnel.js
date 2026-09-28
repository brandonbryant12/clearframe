import { head, animateHead, finish, itemTime, formatter, md } from './_lib.js';
export const meta = {
  tail: 1.2, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Funnel — stages as centred bars that shrink with each step, conversion rates between them.',
  use: 'Pipelines and drop-off: visitors → sign-ups → active. 3–5 stages; the leak you care about gets focus.',
  props: { stages: "[{ label, value, say }]", format: "value format", rates: 'true — show step conversion %', focus: 'index of the step whose drop-off is the story', kicker: '', title: '', source: '' },
  defaults: { rates: true },
  example: { vo: 'Of ten thousand visitors, two thousand start a trial, and only four hundred become weekly users.', props: { title: 'Where people drop off', stages: [{ label: 'Visitors', value: 10000, say: 'ten' }, { label: 'Started a trial', value: 2000, say: 'two' }, { label: 'Weekly users', value: 400, say: 'four' }], focus: 2, source: 'Sample data' } },
};
export const css = `
.b-funnel .col { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: calc(12px * var(--u)); }
.b-funnel .stage { display: grid; grid-template-columns: 1fr calc(260px * var(--u)); align-items: center; gap: calc(30px * var(--u)); }
:root[data-format='vertical'] .b-funnel .stage { grid-template-columns: 1fr; }
.b-funnel .barwrap { display: flex; justify-content: center; }
.b-funnel .bar { height: calc(110px * var(--u)); border-radius: calc(14px * var(--u)); background: var(--ink); display: flex; align-items: center; justify-content: center; color: var(--bg); font-size: calc(52px * var(--u)); font-weight: 650; letter-spacing: -0.03em; min-width: calc(180px * var(--u)); }
.b-funnel .stage.focus .bar { background: var(--accent); color: var(--accent-ink); }
.b-funnel .lab { font-size: var(--t-h3); letter-spacing: -0.02em; }
.b-funnel .rate { display: flex; justify-content: center; font-family: var(--cf-mono); font-size: var(--t-label); color: var(--dim); height: calc(44px * var(--u)); align-items: center; }
.b-funnel .rate.focus { color: var(--accent); font-weight: 600; }
`;
export function html(p) {
  const s = p.stages ?? [];
  const max = Math.max(...s.map((x) => x.value));
  return `<div class="blk b-funnel">${head(p)}<div class="col">${s.map((x, i) => `${i && p.rates ? `<div class="rate${p.focus === i ? ' focus' : ''}">↓ ${Math.round((x.value / s[i - 1].value) * 100)}% continue</div>` : ''}<div class="stage${p.focus === i ? ' focus' : ''}"><div class="barwrap"><div class="bar cf-num" style="width:${Math.max(16, (x.value / max) * 100)}%"></div></div><div class="lab">${md(x.label)}</div></div>`).join('')}</div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const fmt = formatter(p.format, 0);
  const stages = [...el.querySelectorAll('.stage')], rates = [...el.querySelectorAll('.rate')];
  stages.forEach((st, i) => {
    const x = p.stages[i];
    const t = itemTime(ctx, x, i, stages.length, { from: 0.05, to: 0.75 });
    tl.from(st.querySelector('.bar'), { scaleX: 0, duration: 0.7, ease: 'power3.out' }, t);
    kit.counter(st.querySelector('.bar'), t, { from: 0, to: x.value, format: fmt, dur: 0.8 });
    kit.enter(st.querySelector('.lab'), t + 0.15, { y: 10 });
    if (i && rates[i - 1]) kit.enter(rates[i - 1], t - 0.2, { y: -6 });
    sound('tock', t + 0.1, { volume: 0.25 });
  });
  finish(ctx, { driftTarget: el.querySelector('.col') });
}
