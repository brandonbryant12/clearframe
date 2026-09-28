import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Side-by-side comparison — two cards (A vs B) whose points land one by one; the recommended side highlighted.',
  use: 'Decisions and trade-offs. Same criteria on both sides, in the same order. Put the verdict in the narration.',
  props: { left: "{ tag, title, value, valueLabel, points: [text | { text, mark: 'check'|'x'|'dot', say }] }", right: 'same shape', highlight: "'left' | 'right' | none", verdict: 'one line under the cards', verdictSay: '', kicker: '', title: '' },
  defaults: { highlight: 'right' },
  example: { vo: 'Build it ourselves, and we control everything but wait nine months. Buy it, and we launch in six weeks with less flexibility.', props: { title: 'Build or buy?', left: { tag: 'Option A', title: 'Build', points: [{ text: 'Full control', mark: 'check', say: 'control' }, { text: '9 months to launch', mark: 'x', say: 'nine' }] }, right: { tag: 'Option B', title: 'Buy', points: [{ text: 'Live in 6 weeks', mark: 'check', say: 'six' }, { text: 'Less flexibility', mark: 'x', say: 'flexibility' }] }, highlight: 'right' } },
};
export const css = `
.b-cmp .cards { flex: 1; display: grid; grid-template-columns: 1fr auto 1fr; gap: calc(40px * var(--u)); align-items: center; }
:root[data-format='vertical'] .b-cmp .cards { grid-template-columns: 1fr; grid-template-rows: 1fr auto 1fr; }
.b-cmp .card { padding: calc(52px * var(--u)); display: flex; flex-direction: column; gap: calc(24px * var(--u)); min-height: 72%; justify-content: center; }
.b-cmp .card.hi { border-color: var(--accent); box-shadow: 0 0 0 calc(2px * var(--u)) var(--accent) inset; }
.b-cmp .ttl { font-family: var(--cf-display); font-size: calc(120px * var(--u)); line-height: 1; letter-spacing: -0.015em; }
.b-cmp .val { font-size: calc(96px * var(--u)); letter-spacing: -0.05em; line-height: 1; }
.b-cmp .vl { font-size: var(--t-label); color: var(--ink-2); margin-top: calc(-10px * var(--u)); }
.b-cmp .pts { display: flex; flex-direction: column; gap: calc(18px * var(--u)); margin-top: calc(10px * var(--u)); }
.b-cmp .pt { display: flex; align-items: center; gap: calc(22px * var(--u)); font-size: calc(52px * var(--u)); letter-spacing: -0.02em; font-weight: 500; }
.b-cmp .pt .m { flex: none; display: grid; place-items: center; width: calc(62px * var(--u)); height: calc(62px * var(--u)); border-radius: 50%; }
.b-cmp .pt .m.check { color: var(--up); background: color-mix(in oklab, var(--up) 14%, transparent); }
.b-cmp .pt .m.x { color: var(--down); background: color-mix(in oklab, var(--down) 14%, transparent); }
.b-cmp .pt .m.dot { color: var(--dim); background: color-mix(in oklab, var(--ink) 7%, transparent); }
.b-cmp .vs { align-self: center; font-family: var(--cf-display); font-style: italic; font-size: calc(96px * var(--u)); color: var(--dim); text-align: center; }
.b-cmp .verdict { margin-top: calc(30px * var(--u)); font-size: var(--t-h3); letter-spacing: -0.02em; text-align: center; }
`;
const side = (s, hi) => `<div class="card blk-card${hi ? ' hi' : ''}">${s.tag ? `<div class="cf-kicker">${esc(s.tag)}</div>` : ''}<div class="ttl">${md(s.title ?? '')}</div>${s.value != null ? `<div class="val cf-num">${esc(s.value)}</div>${s.valueLabel ? `<div class="vl">${md(s.valueLabel)}</div>` : ''}` : ''}<div class="pts">${(s.points ?? []).map((pt) => { const o = typeof pt === 'string' ? { text: pt, mark: 'dot' } : pt; return `<div class="pt"><span class="m ${o.mark ?? 'dot'}" data-mark="${o.mark ?? 'dot'}"></span><span>${md(o.text)}</span></div>`; }).join('')}</div></div>`;
export const html = (p) => `<div class="blk b-cmp">${head(p)}<div class="cards">${side(p.left ?? {}, p.highlight === 'left')}<div class="vs">vs</div>${side(p.right ?? {}, p.highlight === 'right')}</div>${p.verdict ? `<div class="verdict">${md(p.verdict)}</div>` : ''}</div>`;
export default async function (ctx) {
  const { el, b, kit, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const [cl, cr] = el.querySelectorAll('.card');
  kit.enter(cl, b.at(0.25), { y: 22 });
  kit.enter(el.querySelector('.vs'), b.at(0.45), { y: 0 });
  kit.enter(cr, b.at(0.5), { y: 22 });
  const pts = [...el.querySelectorAll('.pt')];
  const specs = [...(p.left?.points ?? []), ...(p.right?.points ?? [])];
  for (const [i, pt] of pts.entries()) {
    const m = pt.querySelector('.m');
    const kind = m.dataset.mark;
    const icon = await kit.icon(m, kind === 'check' ? 'check' : kind === 'x' ? 'x' : 'minus', { size: 36, stroke: 2.5 });
    const t = itemTime(ctx, specs[i], i, pts.length, { from: 0.1, to: 0.85 });
    kit.enter(pt, t, { y: 10, x: 0 });
    kit.drawIcon(icon, t + 0.1, { dur: 0.3 });
    sound('tock', t + 0.05, { volume: 0.22 });
  }
  const v = el.querySelector('.verdict');
  if (v) kit.reveal(v, cue(p.verdictSay, () => b.end - 1.6), { by: 'words' });
  finish(ctx, { driftTarget: el.querySelector('.cards') });
}
