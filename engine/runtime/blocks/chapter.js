import { esc, md } from './_lib.js';
export const meta = {
  tail: 0.9, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Chapter divider — a big number, a drawn rule, the chapter name.',
  use: 'Films over ~90 s. Gives the viewer a map. Hold 2–3 s.',
  props: { number: "'02'", title: 'chapter name', subtitle: 'optional line' },
  defaults: { number: '01' },
  example: { vo: 'Part two: the mechanism.', props: { number: '02', title: 'The mechanism', subtitle: 'Why waiting grows faster than load' } },
};
export const css = `
.b-chapter { justify-content: center; }
.b-chapter .n { font-family: var(--cf-mono); font-size: calc(64px * var(--u)); color: var(--accent); letter-spacing: 0.04em; }
.b-chapter .rule { height: calc(3px * var(--u)); width: calc(420px * var(--u)); background: var(--ink); margin: calc(28px * var(--u)) 0 calc(34px * var(--u)); transform-origin: 0 50%; }
.b-chapter .t { font-family: var(--cf-display); font-size: calc(170px * var(--u)); line-height: 0.95; letter-spacing: -0.02em; max-width: 12ch; }
:root[data-format='vertical'] .b-chapter .t { font-size: calc(140px * var(--u)); }
.b-chapter .sub { margin-top: calc(26px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-chapter"><div class="n">${esc(p.number)}</div><div class="rule"></div><div class="t">${md(p.title ?? '')}</div>${p.subtitle ? `<div class="sub">${md(p.subtitle)}</div>` : ''}</div>`;
export default function ({ el, b, kit, tl, cue, props: p, sound }) {
  const t0 = cue(p.at, 0.15);
  kit.reveal(el.querySelector('.n'), t0, { by: 'chars', mask: true, stagger: 0.05 });
  tl.from(el.querySelector('.rule'), { scaleX: 0, duration: 0.7, ease: 'power3.inOut' }, t0 + 0.1);
  const r = kit.reveal(el.querySelector('.t'), t0 + 0.3, { by: 'words', mask: true, stagger: 0.07, dur: 0.8 });
  const sub = el.querySelector('.sub');
  if (sub) kit.reveal(sub, r.end, { by: 'words' });
  sound('whoosh', t0 - 0.1, { volume: 0.25 });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
