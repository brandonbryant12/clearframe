// Shared helpers + base styles for ClearFrame blocks. Blocks are ES modules:
//   export const meta = { summary, use, props, defaults, example }
//   export const css = `…`            (injected once)
//   export function html(props, ctx)  (initial markup)
//   export default async function (ctx) { … }   ctx: { el, b, props, kit, tl, cue, sound, format, beat, data, … }
// Node-safe at import time (the CLI reads `meta` from every block); the browser APIs are only touched when building.
const W = globalThis.window;
export const K = W?.CF?.kit;
export const tl = () => W.CF.tl;
export const u = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;

const BASE = `
.blk { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); display: flex; flex-direction: column; }
.blk-head { display: flex; flex-direction: column; gap: calc(16px * var(--u)); margin-bottom: calc(44px * var(--u)); max-width: calc(1500px * var(--u)); flex: none; }
.blk-title { font-family: var(--cf-display); font-size: calc(92px * var(--u)); line-height: 1.02; letter-spacing: -0.015em; }
:root[data-format='vertical'] .blk-title { font-size: calc(84px * var(--u)); }
.blk-body { position: relative; flex: 1; min-height: 0; }
.blk-note { font-size: var(--t-h3); color: var(--accent); font-weight: 600; letter-spacing: -0.02em; }
.blk .cf-num { font-weight: 600; }
.blk-row { display: flex; align-items: center; gap: calc(24px * var(--u)); }
.blk-card { background: var(--surface); border: calc(2px * var(--u)) solid var(--line); border-radius: calc(22px * var(--u)); }
`;
if (W && !document.getElementById('cf-blocks-base')) {
  const st = document.createElement('style');
  st.id = 'cf-blocks-base';
  st.textContent = BASE;
  document.head.appendChild(st);
}

export const isVertical = (ctx) => ctx.format === 'vertical';
export const md = (s) => K.md(s);
export const esc = (s) => K.esc(s);

/** Kicker + title markup (both optional). */
export function head(p) {
  if (!p.kicker && !p.title) return '';
  return `<div class="blk-head">${p.kicker ? `<div class="cf-kicker blk-kicker">${esc(p.kicker)}</div>` : ''}${p.title ? `<div class="blk-title">${md(p.title)}</div>` : ''}</div>`;
}

/** Animate the head; returns the time the title has settled. */
export function animateHead(ctx, at) {
  const { el, kit } = ctx;
  const k = el.querySelector('.blk-kicker'), t = el.querySelector('.blk-title');
  if (k) kit.enter(k, at, { y: 10 });
  if (t) return kit.reveal(t, at + 0.08, { by: 'words' }).end;
  return at;
}

/** Common finishing: source line, slow drift on the body. */
export function finish(ctx, { driftTarget } = {}) {
  const { el, kit, b, props: p } = ctx;
  if (p.source) kit.source(el, p.source, b.at(0.6));
  const target = driftTarget ?? el.querySelector('.blk-body') ?? el.querySelector('.blk');
  if (p.drift !== false && target) kit.drift(target, b.start, (p.until ? ctx.beat(p.until).end : b.end) + 0.5, { scale: 1.02 });
}

/** Value formatter from props: format may be { prefix, suffix, decimals } or a function. */
export function formatter(fmt, fallbackDecimals = 0) {
  if (typeof fmt === 'function') return fmt;
  const f = typeof fmt === 'string' ? { suffix: fmt } : fmt ?? {};
  return (v) => K.fmt(v, { decimals: f.decimals ?? fallbackDecimals, prefix: f.prefix ?? '', suffix: f.suffix ?? '' });
}
export const decimalsOf = (v) => (String(v).split('.')[1] ?? '').length;

/** Tone → CSS color token. */
export const TONES = { accent: 'var(--accent)', ink: 'var(--ink)', 'ink-2': 'var(--ink-2)', dim: 'var(--dim)', line: 'var(--line)', up: 'var(--up)', down: 'var(--down)', accent2: 'var(--accent-2)' };
export const tone = (t, fallback = 'var(--accent)') => (t ? TONES[t] ?? t : fallback);

/** Time for item i: its own cue if given, else spread across the narration. */
export function itemTime(ctx, item, i, n, opts) {
  const spec = item && typeof item === 'object' ? (item.say ?? item.at) : undefined;
  return ctx.cue(spec, () => K.spread(ctx.b, i, n, opts));
}

/** Split text with *emphasis* into word spans: [{ word, em }]. */
export function words(text) {
  let em = false;
  return K.spoken(text).split(/\s+/).filter(Boolean).map((w) => {
    let word = w;
    const open = word.startsWith('*');
    if (open) { em = true; word = word.replace(/^\*+/, ''); }
    const isEm = em;
    if (word.endsWith('*') || /\*[.,;:!?]*$/.test(word)) { em = false; word = word.replace(/\*+([.,;:!?]*)$/, '$1'); }
    return { word, em: isEm };
  });
}

/** Absolute times at which each of `list` (words) is spoken in this beat; unmatched words are interpolated. */
export function wordTimes(ctx, list) {
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9%$]/g, '');
  const vo = ctx.b.vo?.words ?? [];
  const out = new Array(list.length).fill(null);
  let j = 0;
  for (let i = 0; i < list.length; i++) {
    const w = norm(list[i]);
    for (let k = j; k < Math.min(vo.length, j + 4); k++) if (norm(vo[k].w) === w) { out[i] = vo[k].t0; j = k + 1; break; }
  }
  const a = ctx.b.vo ? ctx.b.vo.start : ctx.b.start + 0.3, z = ctx.b.vo ? ctx.b.vo.end : ctx.b.end - 0.6;
  if (!out.length) return out;
  if (out[0] == null) out[0] = a;
  if (out.length > 1 && out[out.length - 1] == null) out[out.length - 1] = Math.max(out[0], z - 0.3);
  let prev = 0;
  for (let i = 1; i < out.length; i++) {
    if (out[i] == null) continue;
    for (let k = prev + 1; k < i; k++) out[k] = out[prev] + ((out[i] - out[prev]) * (k - prev)) / (i - prev);
    prev = i;
  }
  return out;
}
