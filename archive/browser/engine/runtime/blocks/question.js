import { esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Question swap — the wrong question is struck through, the better one rises beneath it.',
  use: 'The turn of an argument ("not X — Y"). Pair with narration that contrasts the two.',
  props: { from: 'the old question (struck)', to: 'the better question; *phrase* gets a marker highlight', kicker: 'optional label', strikeSay: 'word that triggers the strike', toSay: 'word that brings in the new question' },
  defaults: {},
  example: { vo: "So don't ask whether the forecast was right. Ask whether you planned for the thirty.", props: { from: 'Was the forecast right?', to: 'Did we plan for *the 30?*', strikeSay: 'right', toSay: 'ask' } },
};
export const css = `
.b-question { align-items: center; justify-content: center; text-align: center; gap: calc(40px * var(--u)); }
.b-question .line { font-family: var(--cf-display); font-size: calc(128px * var(--u)); line-height: 1.02; letter-spacing: -0.015em; max-width: 16ch; }
:root[data-format='vertical'] .b-question .line { font-size: calc(104px * var(--u)); max-width: 10ch; }
.b-question .old { color: var(--ink-2); font-size: calc(84px * var(--u)); max-width: none; }
:root[data-format='vertical'] .b-question .old { font-size: calc(64px * var(--u)); }
.b-question .new em { font-style: normal; color: var(--accent); }
`;
export const html = (p) => `<div class="blk b-question">${p.kicker ? `<div class="cf-kicker">${esc(p.kicker)}</div>` : ''}<div class="line old"><span class="s">${esc(p.from ?? '')}</span></div><div class="line new">${md(p.to ?? '')}</div></div>`;
export default function ({ el, b, kit, tl, cue, props: p }) {
  const t0 = cue(p.fromSay, 0.1);
  kit.reveal(el.querySelector('.old'), t0, { by: 'words' });
  const strike = p.strikeSay ? b.say(p.strikeSay, { edge: 'end' }) : K_spread(b, 0.4);
  kit.mark(el.querySelector('.old .s'), strike, { kind: 'strike', color: 'var(--ink-2)', dur: 0.45 });
  tl.to(el.querySelector('.old'), { opacity: 0.4, duration: 0.5 }, strike + 0.3);
  const tNew = p.toSay ? b.say(p.toSay, { nth: countBefore(b, p.toSay, strike) }) - 0.1 : K_spread(b, 0.55);
  kit.reveal(el.querySelector('.new'), tNew, { by: 'words' });
  const em = el.querySelector('.new em');
  if (em) kit.mark(em, tNew + 0.6, { kind: 'highlight' });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
const K_spread = (b, f) => (b.vo ? b.vo.start + (b.vo.end - b.vo.start) * f : b.p(f));
/** Occurrences of `word` spoken before time t, so "ask … Ask" picks the one after the strike. */
function countBefore(b, word, t) {
  const n = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (b.vo?.words ?? []).filter((w) => n(w.w).startsWith(n(word)) && w.t0 < t).length;
}
