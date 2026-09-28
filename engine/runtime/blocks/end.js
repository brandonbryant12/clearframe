import { esc, md } from './_lib.js';
export const meta = {
  tail: 1.5, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'End card — the verdict in serif, a next step, sources and disclosures held long enough to read.',
  use: 'Always the last beat. Hold ≥ 4 s. disclose: "auto" adds the AI-voice line when narration is Gemini TTS.',
  props: { title: 'verdict; *word* = accent', subtitle: 'one line', cta: 'next step / URL', source: 'footnote (bottom-left)', disclose: "'auto' | text | false (bottom-right)" },
  defaults: { disclose: 'auto' },
  example: { vo: 'Plan for the thirty.', props: { title: 'Seventy percent is *not* a promise.', subtitle: 'Plan for the thirty.', cta: 'Read the planning guide →', source: 'Hypothetical illustration — figures are explanatory.' } },
};
export const css = `
.b-end { align-items: center; justify-content: center; text-align: center; gap: calc(30px * var(--u)); }
.b-end .t { font-family: var(--cf-display); font-size: calc(132px * var(--u)); line-height: 1; letter-spacing: -0.02em; max-width: 15ch; }
:root[data-format='vertical'] .b-end .t { font-size: calc(110px * var(--u)); max-width: 9ch; }
.b-end .sub { font-size: var(--t-h3); color: var(--ink-2); letter-spacing: -0.02em; }
.b-end .cta { margin-top: calc(10px * var(--u)); font-size: var(--t-label); font-weight: 600; padding: 0.55em 1.1em; border-radius: 999px; border: calc(2px * var(--u)) solid var(--accent); color: var(--accent); }
.b-end-foot { position: absolute; left: var(--safe-x); right: var(--safe-x); bottom: calc(var(--safe-bottom) * 0.5); display: flex; justify-content: space-between; gap: calc(40px * var(--u)); }
.b-end-foot span { font-family: var(--cf-mono); font-size: calc(24px * var(--u)); color: var(--dim); letter-spacing: 0.04em; }
:root[data-format='vertical'] .b-end-foot { flex-direction: column; gap: calc(10px * var(--u)); bottom: calc(var(--safe-bottom) - 40px * var(--u)); }
`;
export function html(p, ctx) {
  const disclose = p.disclose === 'auto' ? (ctx.look?.voiceProvider === 'gemini' ? 'Narration: AI-generated voice' : '') : p.disclose || '';
  return `<div class="blk b-end"><div class="t">${md(p.title ?? '')}</div>${p.subtitle ? `<div class="sub">${md(p.subtitle)}</div>` : ''}${p.cta ? `<div class="cta">${esc(p.cta)}</div>` : ''}</div>
  <div class="b-end-foot" data-safe="margin"><span class="src">${esc(p.source ?? '')}</span><span class="dis">${esc(disclose)}</span></div>`;
}
export default function ({ el, b, kit, cue, props: p, sound }) {
  const t0 = cue(p.land, 0.25);
  const r = kit.reveal(el.querySelector('.t'), t0, { by: 'words', mask: true, stagger: 0.07, dur: 0.8 });
  const sub = el.querySelector('.sub'), cta = el.querySelector('.cta');
  if (sub) kit.reveal(sub, r.end, { by: 'words' });
  if (cta) kit.enter(cta, r.end + 0.4, { y: 10 });
  kit.enter(el.querySelector('.b-end-foot'), t0 + 0.6, { y: 0, dur: 0.6 });
  sound('chime', t0 + 0.2, { volume: 0.22 });
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.02 });
}
