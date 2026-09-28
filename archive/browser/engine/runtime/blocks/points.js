import { head, animateHead, finish, itemTime, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Numbered key points — rows that land one by one on their spoken phrase (the recap).',
  use: 'Recaps, principles, "three things to remember". 2–5 items, ≤ 7 words each.',
  props: { items: '[{ text, say }] — say = word that brings the row in', kicker: '', title: '', numbered: 'true' },
  defaults: { numbered: true },
  example: { vo: 'Seventy is likely, not certain. Check calibration. And plan for the thirty.', props: { kicker: 'Recap', items: [{ text: 'Seventy is likely — *not certain*.', say: 'seventy' }, { text: 'Check the calibration.', say: 'check' }, { text: 'Plan for the thirty.', say: 'plan' }] } },
};
export const css = `
.b-points .list { display: flex; flex-direction: column; gap: calc(34px * var(--u)); justify-content: center; flex: 1; max-width: calc(1400px * var(--u)); }
.b-points .row { display: grid; grid-template-columns: calc(110px * var(--u)) 1fr; align-items: baseline; border-top: calc(2px * var(--u)) solid var(--line); padding-top: calc(28px * var(--u)); }
.b-points .i { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--accent); }
.b-points .t { font-family: var(--cf-display); font-size: calc(100px * var(--u)); line-height: 1.02; letter-spacing: -0.015em; }
:root[data-format='vertical'] .b-points .t { font-size: calc(76px * var(--u)); }
:root[data-format='vertical'] .b-points .row { grid-template-columns: calc(80px * var(--u)) 1fr; }
.b-points .t em { color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-points">${head(p)}<div class="list">${(p.items ?? []).map((it, i) => `<div class="row">${p.numbered ? `<span class="i">${String(i + 1).padStart(2, '0')}</span>` : '<span class="i">—</span>'}<span class="t">${md(typeof it === 'string' ? it : it.text)}</span></div>`).join('')}</div></div>`;
export default function (ctx) {
  const { el, b, kit, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const rows = [...el.querySelectorAll('.row')];
  rows.forEach((row, i) => {
    const t = itemTime(ctx, p.items[i], i, rows.length);
    kit.enter(row, t, { y: 18, dur: 0.55 });
    kit.reveal(row.querySelector('.t'), t + 0.05, { by: 'words', stagger: 0.04 });
    sound('tock', t + 0.05, { volume: 0.3 });
  });
  finish(ctx, { driftTarget: el.querySelector('.list') });
}
