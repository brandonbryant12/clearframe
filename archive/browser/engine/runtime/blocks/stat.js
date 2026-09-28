import { esc, md, decimalsOf } from './_lib.js';
export const meta = {
  tail: 1.5, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Hero number — one figure, big, landing on its spoken word; label, context, delta chip, source.',
  use: 'The headline number of an update, the hook of an explainer. One number per beat.',
  props: {
    value: 'number (required)', from: 'start value for counters (default 0)', prefix: "'$'", suffix: "'%', '×', ' ms'", decimals: 'auto from value',
    style: "'serif' (masked editorial reveal) | 'counter' (counts up) | 'odometer' (rolling digits)", label: 'what the number is', context: 'one line of context',
    delta: "'+12%'", dir: "'up' | 'down' | 'flat'", good: "which direction is good ('up')", deltaLabel: "'vs last year'", land: 'spoken word the number lands on', kicker: '', source: '', align: "'center' | 'left'",
  },
  defaults: { style: 'serif', align: 'center', from: 0, dir: 'up', good: 'up' },
  example: { vo: 'Median wait time fell to four point two days this quarter.', props: { kicker: 'Median wait', value: 4.2, suffix: ' days', label: 'from request to first response', delta: '−31%', dir: 'down', good: 'down', deltaLabel: 'vs Q2', land: 'four', source: 'Service desk export · Q3 2026 (sample data)' } },
};
export const css = `
.b-stat { justify-content: center; }
.b-stat.a-center { align-items: center; text-align: center; }
.b-stat .n { line-height: 0.86; letter-spacing: -0.035em; white-space: nowrap; }
.b-stat.st-serif .n { font-family: var(--cf-display); font-size: calc(330px * var(--u)); }
.b-stat.st-counter .n, .b-stat.st-odometer .n { font-size: calc(250px * var(--u)); letter-spacing: -0.05em; }
:root[data-format='vertical'] .b-stat.st-serif .n { font-size: calc(260px * var(--u)); }
:root[data-format='vertical'] .b-stat .n { font-size: calc(200px * var(--u)); }
.b-stat .n .sfx { font-size: 0.42em; letter-spacing: -0.02em; color: var(--ink-2); margin-left: 0.06em; }
.b-stat .k { margin-bottom: calc(26px * var(--u)); }
.b-stat .l { margin-top: calc(26px * var(--u)); font-size: var(--t-h3); letter-spacing: -0.02em; color: var(--ink-2); }
.b-stat .chip { margin-top: calc(30px * var(--u)); }
.b-stat .c { margin-top: calc(22px * var(--u)); font-size: var(--t-label); color: var(--dim); max-width: 40ch; }
`;
export function html(p) {
  const dec = p.decimals ?? decimalsOf(p.value);
  const final = (window.CF.kit.fmt(p.value, { decimals: dec }));
  const sfx = p.suffix && p.suffix.trim().length > 1 ? `<span class="sfx">${esc(p.suffix)}</span>` : esc(p.suffix ?? '');
  const num = p.style === 'serif' ? `${esc(p.prefix ?? '')}${esc(final)}${sfx}` : '';
  return `<div class="blk b-stat st-${p.style} a-${p.align}">${p.kicker ? `<div class="cf-kicker k">${esc(p.kicker)}</div>` : ''}<div class="n">${num}</div>${p.label ? `<div class="l">${md(p.label)}</div>` : ''}<div class="chipwrap"></div>${p.context ? `<div class="c">${md(p.context)}</div>` : ''}</div>`;
}
export default function ({ el, b, kit, cue, props: p, sound }) {
  const t = cue(p.land, 0.35);
  const n = el.querySelector('.n'), dec = p.decimals ?? decimalsOf(p.value);
  const k = el.querySelector('.k');
  if (k) kit.enter(k, Math.max(b.start, t - 0.4), { y: 10 });
  if (p.style === 'serif') {
    kit.reveal(n, t - 0.05, { by: 'chars', mask: true, stagger: 0.05, dur: 0.65, ease: kit.tokens.ease.snap });
    sound('thud', t + 0.05, { volume: 0.35 });
  } else {
    const long = p.suffix && p.suffix.trim().length > 1;
    const opts = { from: p.from, to: p.value, decimals: dec, prefix: p.prefix ?? '', suffix: long ? '' : p.suffix ?? '', dur: 1.3 };
    // The counter owns its target's textContent. Keep a styled suffix outside it.
    n.innerHTML = `<span class="amount"></span>${long ? `<span class="sfx">${esc(p.suffix)}</span>` : ''}`;
    const amount = n.querySelector('.amount');
    if (p.style === 'odometer') kit.odometer(amount, t, opts); else kit.counter(amount, t, opts);
    kit.enter(n, t - 0.1, { y: 16 });
    sound('tick', t + 1.25, { volume: 0.4 });
  }
  const l = el.querySelector('.l');
  if (l) kit.reveal(l, t + 0.45, { by: 'words' });
  if (p.delta) {
    const chip = kit.chip(el.querySelector('.chipwrap'), p.delta, { dir: p.dir, good: p.good, label: p.deltaLabel });
    chip.classList.add('chip');
    kit.enter(chip, cue(p.deltaSay, () => t + 0.9), { y: 10 });
  }
  const c = el.querySelector('.c');
  if (c) kit.enter(c, t + 1.2, { y: 8 });
  if (p.source) kit.source(el, p.source, t + 0.8);
  kit.drift(el.querySelector('.blk'), b.start, b.end + 0.5, { scale: 1.025 });
}
