import { esc, md } from './_lib.js';
export const meta = {
  tail: 1.3, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Pull quote — oversized quotation mark, serif quote, attribution.',
  use: 'A customer, expert or document in their own words. Attribute precisely; ≤ 25 words.',
  props: { text: 'the quote; *word* = accent', author: 'who said it', role: 'title / organisation / date', land: 'word to start on' },
  defaults: {},
  example: { vo: 'As one planning lead put it: we stopped asking if the forecast was right, and started asking what we would do if it was wrong.', props: { text: 'We stopped asking if the forecast was right, and started asking what we’d do *if it was wrong*.', author: 'Planning lead', role: 'Customer interview, 2026 (paraphrased)' } },
};
export const css = `
.b-quote { justify-content: center; padding-left: calc(150px * var(--u)); }
:root[data-format='vertical'] .b-quote { padding-left: 0; padding-top: calc(120px * var(--u)); }
.b-quote .mark { position: absolute; left: calc(-10px * var(--u)); top: 50%; transform: translateY(-78%); font-family: var(--cf-display); font-size: calc(420px * var(--u)); line-height: 1; color: var(--accent); }
:root[data-format='vertical'] .b-quote .mark { top: 12%; transform: none; font-size: calc(300px * var(--u)); }
.b-quote .tx { font-family: var(--cf-display); font-size: calc(100px * var(--u)); line-height: 1.08; letter-spacing: -0.01em; max-width: 24ch; }
:root[data-format='vertical'] .b-quote .tx { font-size: calc(76px * var(--u)); }
.b-quote .by { margin-top: calc(44px * var(--u)); display: flex; align-items: baseline; gap: calc(18px * var(--u)); }
.b-quote .by b { font-size: var(--t-label); font-weight: 650; }
.b-quote .by span { font-size: var(--t-label); color: var(--dim); }
`;
export const html = (p) => `<div class="blk b-quote"><div class="mark" data-safe="margin">“</div><div class="tx">${md(p.text ?? '')}</div>${p.author ? `<div class="by"><b>— ${esc(p.author)}</b>${p.role ? `<span>${esc(p.role)}</span>` : ''}</div>` : ''}</div>`;
export default function ({ el, b, kit, tl, cue, props: p }) {
  const t0 = cue(p.land, 0.2);
  tl.from(el.querySelector('.mark'), { opacity: 0, y: 30, duration: 0.7, ease: kit.tokens.ease.in }, t0 - 0.2);
  const r = kit.reveal(el.querySelector('.tx'), t0, { by: 'words', stagger: 0.045 });
  const by = el.querySelector('.by');
  if (by) kit.enter(by, Math.min(r.end + 0.2, b.end - 1), { y: 10 });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
