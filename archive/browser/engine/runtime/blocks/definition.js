import { esc, md } from './_lib.js';
export const meta = {
  tail: 1.3, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Dictionary entry — term, pronunciation, part of speech, definition, example.',
  use: 'Introduce jargon precisely before using it. One term per card.',
  props: { term: 'the word', phonetic: '/ˈkæl.ɪ.breɪ.tɪd/', pos: 'adjective / noun …', definition: 'plain-language definition', example: 'optional usage line', land: 'spoken word to land the term on' },
  defaults: {},
  example: { vo: 'Calibrated: when you say seventy percent, it happens about seventy percent of the time.', props: { term: 'calibrated', phonetic: '/ˈkæl.ɪ.breɪ.tɪd/', pos: 'adjective', definition: 'Of a forecast: events given a 70% chance happen about 70% of the time.', example: '“Our delivery estimates are well calibrated.”' } },
};
export const css = `
.b-def { justify-content: center; max-width: calc(1400px * var(--u)); }
.b-def .term { font-family: var(--cf-display); font-size: calc(190px * var(--u)); line-height: 0.95; letter-spacing: -0.02em; }
:root[data-format='vertical'] .b-def .term { font-size: calc(150px * var(--u)); }
.b-def .meta { margin-top: calc(18px * var(--u)); display: flex; gap: calc(24px * var(--u)); align-items: baseline; flex-wrap: wrap; }
.b-def .ph { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--dim); }
.b-def .pos { font-family: var(--cf-display); font-style: italic; font-size: calc(46px * var(--u)); color: var(--accent); }
.b-def .rule { height: calc(2px * var(--u)); background: var(--line); margin: calc(34px * var(--u)) 0; transform-origin: 0 50%; }
.b-def .d { font-size: calc(56px * var(--u)); line-height: 1.22; letter-spacing: -0.02em; max-width: 30ch; font-weight: 450; }
.b-def .ex { margin-top: calc(26px * var(--u)); font-family: var(--cf-display); font-style: italic; font-size: calc(48px * var(--u)); color: var(--ink-2); }
`;
export const html = (p) => `<div class="blk b-def"><div class="term">${esc(p.term ?? '')}</div><div class="meta">${p.phonetic ? `<span class="ph">${esc(p.phonetic)}</span>` : ''}${p.pos ? `<span class="pos">${esc(p.pos)}</span>` : ''}</div><div class="rule"></div><div class="d">${md(p.definition ?? '')}</div>${p.example ? `<div class="ex">${md(p.example)}</div>` : ''}</div>`;
export default function ({ el, b, kit, tl, cue, props: p }) {
  const t0 = cue(p.land, 0.15);
  kit.reveal(el.querySelector('.term'), t0, { by: 'chars', mask: true, stagger: 0.035, dur: 0.6 });
  kit.enter(el.querySelector('.meta'), t0 + 0.45, { y: 10 });
  tl.from(el.querySelector('.rule'), { scaleX: 0, duration: 0.8, ease: 'power3.inOut' }, t0 + 0.55);
  const r = kit.reveal(el.querySelector('.d'), cue(p.defSay, t0 - b.start + 0.8), { by: 'words', stagger: 0.035 });
  const ex = el.querySelector('.ex');
  if (ex) kit.enter(ex, Math.min(r.end + 0.4, b.end - 1.2), { y: 12 });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
