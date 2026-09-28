import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Comparison table — up to 4×4, rows landing in sequence; ✓/✗ cells become icons; one column highlighted.',
  use: 'Feature or option comparisons where the grid itself is the argument. Keep cells to 1–3 words.',
  props: { columns: "['', 'Option A', 'Option B']", rows: "[['Criterion', 'yes', 'no'], …] — 'yes'/'no'/'—' become icons", highlight: '{ col, say }', rowSay: "['word', …] per row", kicker: '', title: '', source: '' },
  defaults: {},
  example: { vo: 'Compared side by side, only the managed option gives us audit logs, single sign-on, and a support SLA.', props: { title: 'What each option includes', columns: ['', 'Self-hosted', 'Managed'], rows: [['Audit logs', 'no', 'yes'], ['Single sign-on', 'yes', 'yes'], ['Support SLA', 'no', 'yes'], ['Setup time', '6 wks', '2 days']], highlight: { col: 2, say: 'managed' }, rowSay: ['audit', 'single', 'support'] } },
};
export const css = `
.b-table .wrap { flex: 1; display: flex; align-items: center; }
.b-table .grid { position: relative; display: grid; width: 100%; }
.b-table .cell { padding: calc(30px * var(--u)) calc(34px * var(--u)); border-bottom: calc(2px * var(--u)) solid var(--line); font-size: calc(50px * var(--u)); letter-spacing: -0.02em; display: flex; align-items: center; position: relative; z-index: 1; }
.b-table .cell.h { font-family: var(--cf-mono); font-size: var(--t-label); text-transform: uppercase; letter-spacing: 0.1em; color: var(--dim); border-bottom-color: var(--ink); }
.b-table .cell.first { font-weight: 560; }
.b-table .cell .yes { color: var(--up); } .b-table .cell .no { color: var(--down); opacity: 0.8; } .b-table .cell .na { color: var(--dim); }
.b-table .band { position: absolute; top: 0; bottom: 0; background: var(--accent-soft); border-radius: calc(16px * var(--u)); transform-origin: 50% 0; z-index: 0; }
`;
const kind = (c) => { const s = String(c).trim().toLowerCase(); return ['yes', '✓', 'true'].includes(s) ? 'yes' : ['no', '✗', 'false'].includes(s) ? 'no' : ['—', '-', 'n/a'].includes(s) ? 'na' : null; };
export function html(p) {
  const cols = p.columns ?? [];
  const tmpl = `minmax(${Math.min(40, 100 / cols.length + 10)}%, 1.4fr) ${cols.slice(1).map(() => '1fr').join(' ')}`;
  const cell = (c, j, h) => { const k = h ? null : kind(c); return `<div class="cell${h ? ' h' : ''}${j === 0 ? ' first' : ''}" data-col="${j}">${k ? `<span class="${k}" data-icon="${k}"></span>` : md(String(c))}</div>`; };
  return `<div class="blk b-table">${head(p)}<div class="wrap"><div class="grid" style="grid-template-columns:${tmpl}">${cols.map((c, j) => cell(c, j, true)).join('')}${(p.rows ?? []).map((r) => r.map((c, j) => cell(c, j, false)).join('')).join('')}</div></div></div>`;
}
export default async function (ctx) {
  const { el, b, kit, tl, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const grid = el.querySelector('.grid');
  const ncol = (p.columns ?? []).length;
  const cells = [...grid.querySelectorAll('.cell')];
  for (const s of grid.querySelectorAll('[data-icon]')) {
    const k = s.dataset.icon;
    const ic = await kit.icon(s, k === 'yes' ? 'check' : k === 'no' ? 'x' : 'minus', { size: 50, stroke: 2.5 });
    s.dataset.svg = '1'; s._icon = ic;
  }
  kit.enter(cells.slice(0, ncol), b.at(0.2), { y: 8, stagger: 0.05 });
  const rows = (p.rows ?? []).length;
  for (let r = 0; r < rows; r++) {
    const rc = cells.slice(ncol * (r + 1), ncol * (r + 2));
    const t = itemTime(ctx, { say: p.rowSay?.[r] }, r, rows, { from: 0.05, to: 0.75 });
    kit.enter(rc, t, { y: 10, stagger: 0.06 });
    rc.forEach((c, j) => { const s = c.querySelector('[data-icon]'); if (s?._icon) kit.drawIcon(s._icon, t + 0.1 + j * 0.06, { dur: 0.3 }); });
    sound('tock', t, { volume: 0.22 });
  }
  if (p.highlight?.col != null) {
    const c0 = cells[p.highlight.col];
    const band = document.createElement('div');
    band.className = 'band';
    Object.assign(band.style, { left: `${c0.offsetLeft}px`, width: `${c0.offsetWidth}px` });
    grid.appendChild(band);
    tl.from(band, { scaleY: 0, duration: 0.6, ease: 'power3.out' }, cue(p.highlight.say, () => b.end - 2));
  }
  finish(ctx, { driftTarget: el.querySelector('.wrap') });
}
