import { head, animateHead, finish, itemTime, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Checklist — items listed, then ticked (or crossed) as they are spoken.',
  use: 'How-tos, readiness reviews, requirements. 3–6 items.',
  props: { items: "[{ text, say, state: 'done' | 'fail' | 'todo' }]", kicker: '', title: '' },
  defaults: {},
  example: { vo: 'Before launch: the forecast is calibrated, the rollback is tested, and the on-call rota is set. The load test is still open.', props: { title: 'Launch readiness', items: [{ text: 'Forecast calibrated', say: 'calibrated' }, { text: 'Rollback tested', say: 'rollback' }, { text: 'On-call rota set', say: 'rota' }, { text: 'Load test complete', say: 'load', state: 'todo' }] } },
};
export const css = `
.b-check .list { display: flex; flex-direction: column; gap: calc(40px * var(--u)); justify-content: center; flex: 1; }
.b-check .row { display: flex; align-items: center; gap: calc(34px * var(--u)); }
.b-check .box { position: relative; width: calc(84px * var(--u)); height: calc(84px * var(--u)); border-radius: calc(14px * var(--u)); border: calc(3px * var(--u)) solid var(--line); flex: none; display: grid; place-items: center; }
.b-check .box .fill { position: absolute; inset: calc(-3px * var(--u)); border-radius: inherit; background: var(--accent); transform: scale(0); }
.b-check .box svg { position: relative; color: var(--accent-ink); }
.b-check .row.fail .box .fill { background: var(--down); }
.b-check .t { font-size: calc(76px * var(--u)); font-weight: 560; letter-spacing: -0.025em; }
.b-check .row.todo .t { color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-check">${head(p)}<div class="list">${(p.items ?? []).map((it) => `<div class="row ${it.state ?? 'done'}"><span class="box"><i class="fill"></i></span><span class="t">${md(it.text)}</span></div>`).join('')}</div></div>`;
export default async function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  const t0 = animateHead(ctx, b.at(0.05));
  const rows = [...el.querySelectorAll('.row')];
  kit.enter(rows, Math.max(b.at(0.2), t0 - 0.4), { y: 14, stagger: 0.08 });
  for (const [i, row] of rows.entries()) {
    const it = p.items[i];
    const state = it.state ?? 'done';
    if (state === 'todo') continue;
    const t = itemTime(ctx, it, i, rows.length);
    const icon = await kit.icon(row.querySelector('.box'), state === 'fail' ? 'x' : 'check', { size: 54, stroke: 3 });
    tl.to(row.querySelector('.fill'), { scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, t);
    kit.drawIcon(icon, t + 0.12, { dur: 0.35 });
    sound('tock', t + 0.1, { volume: 0.35 });
  }
  finish(ctx, { driftTarget: el.querySelector('.list') });
}
