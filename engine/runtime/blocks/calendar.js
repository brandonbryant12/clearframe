import { head, animateHead, finish, esc } from './_lib.js';
export const meta = {
  tail: 1.2, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Calendar heatmap — weeks × days of activity, filled column by column; outline a streak or a gap.',
  use: 'Habits, deploy frequency, incidents over time. The shape of a year at a glance.',
  props: { values: "array of 0–4 levels (week-major, 7 per week) or 'demo'", weeks: '26', streak: '{ from, to, label, say } (week indices)', legend: 'true', startLabel: '', endLabel: '', kicker: '', title: '', source: '' },
  defaults: { weeks: 26, legend: true },
  example: { vo: 'Deploys used to cluster at the end of each month. Since July, they happen every single day.', props: { title: 'Deploys per day', values: 'demo', weeks: 26, streak: { from: 17, to: 25, label: 'Daily since July', say: 'since' }, startLabel: 'Apr', endLabel: 'Sep', source: 'Sample data' } },
};
export const css = `
.b-cal .body { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: calc(22px * var(--u)); }
.b-cal .grid { position: relative; display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 1fr); }
.b-cal .cell { border-radius: 22%; }
.b-cal .foot { display: flex; justify-content: space-between; align-items: center; font-family: var(--cf-mono); font-size: calc(24px * var(--u)); color: var(--dim); }
.b-cal .legend { display: flex; gap: calc(8px * var(--u)); align-items: center; }
.b-cal .legend i { width: calc(22px * var(--u)); height: calc(22px * var(--u)); border-radius: 22%; display: inline-block; }
.b-cal .streak { position: absolute; border: calc(3px * var(--u)) solid var(--accent); border-radius: calc(12px * var(--u)); pointer-events: none; }
.b-cal .slabel { position: absolute; font-size: var(--t-label); font-weight: 650; color: var(--accent); white-space: nowrap; }
`;
const LV = [8, 28, 50, 74, 100];
const shade = (l) => (l <= 0 ? 'color-mix(in oklab, var(--line) 70%, transparent)' : `color-mix(in oklab, var(--accent) ${LV[l]}%, var(--bg-2))`);
function demo(weeks) { const r = window.CF.rand('cal'); const out = []; for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) { const late = w >= weeks - 9; const endMonth = w % 4 === 3; out.push(late ? (d < 5 ? 2 + Math.floor(r() * 3) : Math.floor(r() * 2)) : endMonth && d < 5 ? 1 + Math.floor(r() * 4) : r() < 0.15 ? 1 : 0); } return out; }
export function html(p) {
  const vals = p.values === 'demo' || !p.values ? demo(p.weeks) : p.values;
  const cells = vals.map((l) => `<div class="cell" style="background:${shade(l)}"></div>`).join('');
  const legend = p.legend ? `<span class="legend">less ${[0, 1, 2, 3, 4].map((l) => `<i style="background:${shade(l)}"></i>`).join('')} more</span>` : '';
  return `<div class="blk b-cal">${head(p)}<div class="body blk-body"><div class="grid">${cells}</div><div class="foot"><span>${esc(p.startLabel ?? '')}</span>${legend}<span>${esc(p.endLabel ?? '')}</span></div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const grid = el.querySelector('.grid');
  const weeks = Math.ceil(grid.children.length / 7);
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const W = el.querySelector('.body').offsetWidth, BH = el.querySelector('.body').offsetHeight, gap = 8 * uu;
  const tall = ctx.format === 'vertical'; // 9:16: weeks run down the frame, days across
  const cell = tall ? Math.min((W - gap * 6) / 7, (BH - 120 * uu - gap * (weeks - 1)) / weeks) : Math.min((W - gap * (weeks - 1)) / weeks, (BH - 120 * uu) / 7);
  if (tall) Object.assign(grid.style, { gridAutoFlow: 'row', gridTemplateColumns: `repeat(7, ${cell}px)`, gridTemplateRows: `repeat(${weeks}, ${cell}px)`, gap: `${gap}px`, justifyContent: 'center' });
  else Object.assign(grid.style, { gridTemplateColumns: `repeat(${weeks}, ${cell}px)`, gridTemplateRows: `repeat(7, ${cell}px)`, gap: `${gap}px`, justifyContent: 'center' });
  const cells = [...grid.children];
  const t0 = b.at(0.25);
  for (let w = 0; w < weeks; w++) tl.from(cells.slice(w * 7, w * 7 + 7), { opacity: 0, scale: 0.4, duration: 0.35, ease: 'power2.out', stagger: 0.015 }, t0 + w * 0.035);
  kit.enter(el.querySelector('.foot'), t0 + weeks * 0.035, { y: 8 });
  if (p.streak) {
    const t = cue(p.streak.say, () => t0 + weeks * 0.035 + 0.6);
    const span = (p.streak.to - p.streak.from + 1) * (cell + gap) + gap, start = p.streak.from * (cell + gap) - gap;
    const box = document.createElement('div');
    box.className = 'streak';
    let x;
    if (tall) {
      x = (grid.offsetWidth - (7 * (cell + gap) - gap)) / 2 - gap;
      Object.assign(box.style, { left: `${x}px`, top: `${start}px`, width: `${7 * (cell + gap) + gap}px`, height: `${span}px` });
    } else {
      x = (grid.offsetWidth - (weeks * (cell + gap) - gap)) / 2 + start;
      Object.assign(box.style, { left: `${x}px`, top: `${-gap}px`, width: `${span}px`, height: `${7 * (cell + gap) + gap}px` });
    }
    grid.appendChild(box);
    tl.from(box, { opacity: 0, scale: 1.04, duration: 0.5, ease: 'power3.out' }, t);
    if (p.streak.label) {
      const lab = document.createElement('div');
      lab.className = 'slabel';
      lab.textContent = p.streak.label;
      Object.assign(lab.style, tall ? { left: `${x}px`, top: `${start - 52 * uu}px` } : { left: `${x}px`, top: `${-gap - 52 * uu}px` });
      grid.appendChild(lab);
      kit.enter(lab, t + 0.2, { y: 8 });
    }
    sound('tick', t, { volume: 0.3 });
  }
  finish(ctx, { driftTarget: el.querySelector('.body') });
}
