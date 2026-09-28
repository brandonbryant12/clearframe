import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Code walkthrough — an editor panel; lines type or fade in, then highlighted ranges step through with notes.',
  use: 'Technical explainers, API how-tos, changelogs. ≤ 16 lines; highlight 1–3 ranges; say what each does.',
  props: { code: 'source text', lang: "'js' | 'ts' | 'py' | 'sql' | 'go' | 'sh' | …", filename: 'shown in the title bar', highlight: "[{ lines: '3-5' | [3,5], say, note }]", type: 'false — true types the code in', kicker: '', title: '' },
  defaults: { lang: 'js', type: false },
  example: { vo: 'The whole change is two lines: we read the forecast, and we plan for the miss explicitly.', props: { filename: 'plan.ts', lang: 'ts', code: "export function plan(forecast: number) {\n  const p = clamp(forecast, 0, 1);\n  const miss = 1 - p; // the thirty\n  return {\n    commit: p >= 0.7,\n    buffer: Math.ceil(miss * 10), // days\n  };\n}", highlight: [{ lines: '2', say: 'read', note: 'Read the probability' }, { lines: '3', say: 'miss', note: 'Name the miss' }] } },
};
const KW = new Set('const let var function return if else for while do switch case break continue new class extends import from export default async await try catch finally throw typeof instanceof in of true false null undefined this def elif lambda pass None True False and or not with as yield fn mut impl pub struct enum match use mod func package type interface go defer chan map range select from where join left right inner on group by order limit insert into values update set delete create table having count sum avg'.split(' '));
function tokens(line, lang) {
  const comment = ['py', 'sh', 'bash', 'yaml', 'yml', 'rb', 'python'].includes(lang) ? /^#.*/ : lang === 'sql' ? /^--.*/ : /^\/\/.*/;
  let out = '', s = line;
  while (s.length) {
    let m;
    if ((m = s.match(comment))) { out += `<span class="c">${esc(m[0])}</span>`; break; }
    if ((m = s.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/))) out += `<span class="s">${esc(m[0])}</span>`;
    else if ((m = s.match(/^\b\d+(?:\.\d+)?\b/))) out += `<span class="n">${m[0]}</span>`;
    else if ((m = s.match(/^[A-Za-z_]\w*/))) out += KW.has(lang === 'sql' ? m[0].toLowerCase() : m[0]) ? `<span class="k">${m[0]}</span>` : /^\s*\(/.test(s.slice(m[0].length)) ? `<span class="f">${m[0]}</span>` : esc(m[0]);
    else { m = [s[0]]; out += esc(m[0]); }
    s = s.slice(m[0].length);
  }
  return out || ' ';
}
const range = (l) => { if (Array.isArray(l)) return [l[0], l[1] ?? l[0]]; const [a, z] = String(l).split('-').map(Number); return [a, z ?? a]; };
export const css = `
.b-code .panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.b-code .bar { display: flex; align-items: center; gap: calc(12px * var(--u)); padding: calc(20px * var(--u)) calc(26px * var(--u)); border-bottom: calc(2px * var(--u)) solid var(--line); }
.b-code .bar i { width: calc(16px * var(--u)); height: calc(16px * var(--u)); border-radius: 50%; background: var(--line); }
.b-code .bar span { margin-left: calc(14px * var(--u)); font-family: var(--cf-mono); font-size: calc(24px * var(--u)); color: var(--dim); }
.b-code .wrap { position: relative; display: grid; grid-template-columns: auto 1fr; align-items: start; column-gap: calc(22px * var(--u)); padding: calc(34px * var(--u)) calc(40px * var(--u)); font-family: var(--cf-mono); line-height: 1.6; flex: 1; align-content: center; }
.b-code .ln { color: var(--dim); text-align: right; opacity: 0.6; }
.b-code .l { white-space: pre; position: relative; z-index: 1; }
.b-code .k { color: var(--accent); font-weight: 600; } .b-code .s { color: var(--up); } .b-code .n { color: var(--accent-2); } .b-code .c { color: var(--dim); font-style: italic; } .b-code .f { color: var(--ink); font-weight: 600; }
.b-code .hl { position: absolute; left: calc(12px * var(--u)); right: calc(12px * var(--u)); background: var(--accent-soft); border-left: calc(5px * var(--u)) solid var(--accent); border-radius: calc(8px * var(--u)); z-index: 0; transform-origin: 0 50%; }
.b-code .note { position: absolute; right: calc(40px * var(--u)); padding: calc(14px * var(--u)) calc(22px * var(--u)); background: var(--accent); color: var(--accent-ink); border-radius: calc(12px * var(--u)); font-family: var(--cf-sans); font-weight: 600; font-size: calc(30px * var(--u)); z-index: 2; white-space: nowrap; }
`;
export function html(p) {
  const lines = String(p.code ?? '').replace(/\t/g, '  ').split('\n');
  return `<div class="blk b-code">${head(p)}<div class="panel blk-card"><div class="bar"><i></i><i></i><i></i><span>${esc(p.filename ?? p.lang)}</span></div><div class="wrap">${lines.map((l, i) => `<span class="ln">${i + 1}</span><span class="l" data-raw="${esc(l)}">${tokens(l, p.lang)}</span>`).join('')}</div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const wrap = el.querySelector('.wrap');
  const lines = [...wrap.querySelectorAll('.l')], nums = [...wrap.querySelectorAll('.ln')];
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const longest = Math.max(...lines.map((l) => l.dataset.raw.length), 10);
  const fs = Math.max(24 * uu, Math.min(46 * uu, (wrap.offsetHeight - 70 * uu) / (lines.length * 1.6), (wrap.offsetWidth - 140 * uu) / ((longest + 4) * 0.6)));
  wrap.dataset.dense = '';
  wrap.style.fontSize = `${fs}px`;
  kit.enter(el.querySelector('.panel'), b.at(0.1), { y: 20 });
  const t0 = b.at(0.35);
  if (p.type) {
    let t = t0;
    lines.forEach((l, i) => {
      const raw = l.dataset.raw;
      const cps = 42;
      tl.from([nums[i]], { opacity: 0, duration: 0.1 }, t);
      tl.fromTo(l, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: Math.max(0.05, raw.length / cps), ease: 'none', immediateRender: true }, t);
      t += raw.length / cps + 0.05;
    });
  } else {
    tl.from([...lines, ...nums], { opacity: 0, x: -8, duration: 0.4, stagger: 0.03, ease: 'power2.out' }, t0);
  }
  const hls = p.highlight ?? [];
  hls.forEach((h, k) => {
    const [a, z] = range(h.lines);
    const first = lines[a - 1], last = lines[z - 1];
    if (!first || !last) return;
    const top = first.offsetTop - fs * 0.12, height = last.offsetTop + last.offsetHeight - first.offsetTop + fs * 0.24;
    const band = document.createElement('div');
    band.className = 'hl';
    Object.assign(band.style, { top: `${top}px`, height: `${height}px` });
    wrap.appendChild(band);
    const t = itemTime(ctx, h, k, hls.length, { from: 0.25, to: 0.85 });
    const hasNext = k < hls.length - 1;
    const tEnd = hasNext ? itemTime(ctx, hls[k + 1], k + 1, hls.length, { from: 0.25, to: 0.85 }) : null;
    tl.fromTo(band, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.45, ease: 'power3.out', immediateRender: true }, t);
    if (hasNext) tl.to(band, { opacity: 0, duration: 0.3 }, tEnd - 0.1);
    const others = lines.filter((_, i) => i < a - 1 || i > z - 1);
    tl.to(others, { opacity: 0.32, duration: 0.35 }, t);
    if (hasNext) tl.to(others, { opacity: 1, duration: 0.35 }, tEnd - 0.1);
    if (h.note) {
      const note = document.createElement('div');
      note.className = 'note';
      note.innerHTML = md(h.note);
      if (wrap.offsetWidth < 1200 * uu) { // narrow frames: a caption slot under the code (one note at a time)
        const lastLine = lines.at(-1);
        note.style.top = `${lastLine.offsetTop + lastLine.offsetHeight + 28 * uu}px`; note.style.right = 'auto'; note.style.left = `${40 * uu}px`;
      }
      else { note.style.top = `${top + height / 2}px`; note.style.transform = 'translateY(-50%)'; }
      wrap.appendChild(note);
      tl.fromTo(note, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out', immediateRender: true }, t + 0.2);
      if (hasNext) tl.to(note, { opacity: 0, duration: 0.3 }, tEnd - 0.1);
    }
    sound('tick', t, { volume: 0.25 });
  });
  finish(ctx, { driftTarget: el.querySelector('.panel') });
}
