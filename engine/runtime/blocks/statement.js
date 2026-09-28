import { words, wordTimes } from './_lib.js';
export const meta = {
  tail: 0.9, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Kinetic statement — the narration itself as big type; each word lights up as it is spoken.',
  use: 'The thesis, a key sentence, a takeaway. Defaults to the beat narration. ≤ 18 words.',
  props: { text: 'defaults to the beat narration; *word* = accent', size: 'm | l | xl', mode: 'karaoke (dim → lit on the word) | reveal (words appear)', align: 'left | center', dim: 'opacity of unspoken words (karaoke)' },
  defaults: { size: 'l', mode: 'karaoke', align: 'left', dim: 0.16 },
  example: { vo: 'Good forecasts are not always right. They are honest about how often they will be wrong.', props: { text: 'Good forecasts are not always right. They are *honest* about how often they will be wrong.' } },
};
export const css = `
.b-statement { justify-content: center; }
.b-statement.a-center { align-items: center; text-align: center; }
.b-statement .tx { font-family: var(--cf-display); line-height: 1.04; letter-spacing: -0.015em; max-width: 19ch; }
.b-statement.s-m .tx { font-size: calc(84px * var(--u)); } .b-statement.s-l .tx { font-size: calc(112px * var(--u)); } .b-statement.s-xl .tx { font-size: calc(140px * var(--u)); }
:root[data-format='vertical'] .b-statement .tx { font-size: calc(96px * var(--u)); max-width: 12ch; }
.b-statement .w { display: inline-block; margin-right: 0.24em; }
.b-statement .w.em { color: var(--accent); font-style: italic; }
`;
export function html(p, ctx) {
  const list = words(p.text ?? ctx.b.vo?.text ?? '');
  return `<div class="blk b-statement s-${p.size} a-${p.align}"><div class="tx">${list.map((w) => `<span class="w${w.em ? ' em' : ''}">${w.word.replace(/</g, '&lt;')}</span>`).join('')}</div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p } = ctx;
  const spans = [...el.querySelectorAll('.w')];
  const times = wordTimes(ctx, spans.map((s) => s.textContent));
  if (p.mode === 'karaoke') {
    tl.set(spans, { opacity: p.dim }, 0);
    tl.from(el.querySelector('.tx'), { opacity: 0, y: 14, duration: 0.5 }, b.at(0.05));
    spans.forEach((s, i) => tl.to(s, { opacity: 1, duration: 0.18, ease: 'power1.out' }, times[i] - 0.04));
  } else {
    spans.forEach((s, i) => tl.from(s, { opacity: 0, y: '0.3em', duration: 0.45, ease: kit.tokens.ease.in }, times[i] - 0.1));
  }
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
