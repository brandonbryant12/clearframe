import { head, animateHead, finish, itemTime, esc, md, tone } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Composition bar — one 100% bar split into parts that slide in one by one, labelled underneath.',
  use: 'Where the time / money / effort goes. 2–5 parts; the story part gets the accent.',
  props: { parts: "[{ label, value, tone, say }] (values are shares; they're normalised)", focus: 'index of the story part (accent)', unit: "'%' (default) — how to print each share", kicker: '', title: '', source: '' },
  defaults: { focus: 0, unit: '%' },
  example: { vo: 'Where does an engineer’s week go? Only about a third is building. The rest is meetings, reviews and waiting.', props: { title: 'Where the week goes', parts: [{ label: 'Building', value: 34, say: 'building' }, { label: 'Meetings', value: 26, say: 'meetings' }, { label: 'Reviews', value: 18, say: 'reviews' }, { label: 'Waiting', value: 22, say: 'waiting' }], focus: 0, source: 'Time-tracking survey, n = 212 (sample data)' } },
};
const PAL = ['var(--ink)', 'var(--ink-2)', 'var(--dim)', 'var(--line)', 'var(--bg-2)'];
export const css = `
.b-share .body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: calc(40px * var(--u)); }
.b-share .bar { position: relative; display: flex; height: calc(140px * var(--u)); border-radius: calc(18px * var(--u)); overflow: hidden; background: color-mix(in oklab, var(--line) 35%, transparent); }
.b-share .seg { height: 100%; }
.b-share .seg + .seg { border-left: calc(4px * var(--u)) solid var(--bg); }
.b-share .labels { position: relative; height: calc(160px * var(--u)); }
.b-share .lab { position: absolute; top: 0; display: flex; flex-direction: column; gap: calc(6px * var(--u)); padding-left: calc(4px * var(--u)); border-left: calc(2px * var(--u)) solid var(--line); padding: 0 0 0 calc(16px * var(--u)); }
.b-share .lab .v { font-size: calc(64px * var(--u)); line-height: 1; letter-spacing: -0.04em; }
.b-share .lab .l { font-size: var(--t-label); color: var(--ink-2); white-space: nowrap; }
.b-share.legend .labels { position: static; height: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: calc(26px * var(--u)); }
.b-share.legend .lab { position: static; }
`;
export function html(p, ctx) {
  const parts = p.parts ?? [];
  const sum = parts.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const legend = ctx.format === 'vertical' || parts.some((x) => x.value / sum < 0.14);
  const segs = parts.map((x, i) => `<div class="seg" style="width:${(x.value / sum) * 100}%;background:${i === p.focus ? 'var(--accent)' : tone(x.tone, PAL[i % PAL.length])}"></div>`).join('');
  const labs = parts.map((x, i) => { const left = (acc / sum) * 100; acc += x.value; return `<div class="lab" style="left:${left}%"><span class="v cf-num" style="color:${i === p.focus ? 'var(--accent)' : 'var(--ink)'}">0</span><span class="l">${md(x.label)}</span></div>`; }).join('');
  return `<div class="blk b-share${legend ? ' legend' : ''}">${head(p)}<div class="body blk-body"><div class="bar">${segs}</div><div class="labels">${labs}</div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const parts = p.parts ?? [];
  const sum = parts.reduce((s, x) => s + x.value, 0) || 1;
  const segs = [...el.querySelectorAll('.seg')], labs = [...el.querySelectorAll('.lab')];
  parts.forEach((x, i) => {
    const t = itemTime(ctx, x, i, parts.length, { from: 0.1, to: 0.8 });
    tl.from(segs[i], { clipPath: 'inset(0 100% 0 0)', duration: 0.6, ease: 'power3.out' }, t);
    kit.enter(labs[i], t + 0.1, { y: 10 });
    const share = (x.value / sum) * 100;
    kit.counter(labs[i].querySelector('.v'), t + 0.1, { to: p.unit === '%' ? share : x.value, decimals: 0, suffix: p.unit === '%' ? '%' : p.unit ?? '', dur: 0.7 });
    sound('tock', t + 0.1, { volume: 0.25 });
  });
  finish(ctx);
}
