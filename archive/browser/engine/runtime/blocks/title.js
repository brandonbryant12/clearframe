import { esc, md } from './_lib.js';
export const meta = {
  tail: 0.9, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Opening or section title — kicker, a serif headline (with *emphasis*), optional subtitle.',
  use: 'Cold opens, section openers, the promise of the film. Keep the headline ≤ 8 words.',
  props: { kicker: 'small mono label above', title: 'headline; *word* = accent italic', subtitle: 'one supporting line', align: 'center | left', size: 'l | xl | xxl', land: 'spoken word the headline lands on' },
  defaults: { align: 'center', size: 'xl' },
  example: { vo: 'Every forecast is a promise with a margin of error.', props: { kicker: 'A field guide', title: 'Forecasts are *not* promises', subtitle: 'How to read a probability — and plan for the rest' } },
};
export const css = `
.b-title { justify-content: center; }
.b-title.a-center { align-items: center; text-align: center; }
.b-title.a-left { align-items: flex-start; justify-content: flex-end; padding-bottom: 4%; }
.b-title .k { margin-bottom: calc(28px * var(--u)); }
.b-title .t { font-family: var(--cf-display); line-height: 0.98; letter-spacing: -0.02em; max-width: 14ch; }
.b-title.s-l .t { font-size: calc(112px * var(--u)); } .b-title.s-xl .t { font-size: calc(150px * var(--u)); } .b-title.s-xxl .t { font-size: calc(210px * var(--u)); }
:root[data-format='vertical'] .b-title.s-xl .t { font-size: calc(132px * var(--u)); max-width: 9ch; }
.b-title .sub { margin-top: calc(30px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); max-width: 32ch; letter-spacing: -0.02em; line-height: 1.2; }
`;
export const html = (p) => `<div class="blk b-title a-${p.align} s-${p.size}">
  ${p.kicker ? `<div class="cf-kicker k">${esc(p.kicker)}</div>` : ''}
  <div class="t">${md(p.title ?? '')}</div>
  ${p.subtitle ? `<div class="sub">${md(p.subtitle)}</div>` : ''}</div>`;
export default function ({ el, b, kit, cue, props: p, sound }) {
  const t0 = cue(p.land, 0.2);
  const k = el.querySelector('.k'), sub = el.querySelector('.sub');
  if (k) kit.enter(k, t0 - 0.15, { y: 10 });
  const r = kit.reveal(el.querySelector('.t'), t0, { by: 'words', mask: true, stagger: 0.06, dur: 0.8 });
  if (sub) kit.reveal(sub, cue(p.subSay, () => r.end + 0.1), { by: 'words' });
  sound('rise', t0 - 0.7, { volume: 0.2 });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.025 });
}
