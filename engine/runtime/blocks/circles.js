import { head, animateHead, finish, itemTime, formatter, md, tone } from './_lib.js';
export const meta = {
  tail: 1.4, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Magnitude circles — areas proportional to value, side by side on a baseline.',
  use: '"How big is X next to Y" when the ratio is large (10× and up). Label every circle with its value.',
  props: { items: "[{ label, value, tone, say }]", format: "{ prefix, suffix } or '×'", kicker: '', title: '', source: '' },
  defaults: {},
  example: { vo: 'One percent better every day compounds to about thirty-eight times better in a year.', props: { title: 'One year of daily 1% changes', items: [{ label: 'Where you started', value: 1, tone: 'dim' }, { label: '1% better daily', value: 37.8, tone: 'accent', say: 'thirty' }], format: '×' } },
};
export const css = `
.b-circles .row { flex: 1; display: flex; align-items: flex-end; justify-content: center; gap: calc(90px * var(--u)); padding-bottom: calc(10px * var(--u)); }
.b-circles .it { display: flex; flex-direction: column; align-items: center; gap: calc(24px * var(--u)); }
.b-circles .c { border-radius: 50%; transform-origin: 50% 100%; }
.b-circles .v { font-size: calc(72px * var(--u)); letter-spacing: -0.04em; line-height: 1; }
.b-circles .l { font-size: var(--t-label); color: var(--ink-2); text-align: center; max-width: 14ch; }
`;
export function html(p) {
  return `<div class="blk b-circles">${head(p)}<div class="row">${(p.items ?? []).map((it) => `<div class="it"><div class="c" style="background:${tone(it.tone, 'var(--ink)')}"></div><div class="v cf-num"></div><div class="l">${md(it.label)}</div></div>`).join('')}</div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const row = el.querySelector('.row');
  const items = p.items ?? [];
  const maxV = Math.max(...items.map((i) => i.value));
  const maxD = Math.min(row.offsetHeight - 170 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1), (row.offsetWidth / items.length) * 0.8);
  const fmt = formatter(p.format, 1);
  [...el.querySelectorAll('.it')].forEach((node, i) => {
    const it = items[i];
    const d = Math.max(10, maxD * Math.sqrt(it.value / maxV));
    const c = node.querySelector('.c');
    Object.assign(c.style, { width: `${d}px`, height: `${d}px` });
    const t = itemTime(ctx, it, i, items.length, { from: 0.05, to: 0.7 });
    tl.from(c, { scale: 0, duration: 0.9, ease: 'power3.out' }, t);
    kit.enter([node.querySelector('.l')], t + 0.2, { y: 8 });
    kit.counter(node.querySelector('.v'), t, { from: 0, to: it.value, format: fmt, dur: 0.9 });
    sound('pop', t, { volume: 0.25 });
  });
  finish(ctx, { driftTarget: row });
}
