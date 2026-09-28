import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.2, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Product / UI walkthrough — a browser window (your screenshot, HTML, or a built-in mock) with spotlight callouts, a cursor that clicks, optional zoom-ins.',
  use: 'Feature explainers, onboarding, "where to click". Real screenshots are best; never fake a real company\'s UI.',
  props: { url: 'address bar text', image: 'screenshot path (e.g. assets/img/app.png)', html: 'or inline HTML for the page', mock: "'dashboard' | 'list' | 'form' | 'doc' (skeleton UI when you have no screenshot)", callouts: "[{ x, y, w, h (0–1 of the page), label, say, click: true, zoom: false }]", kicker: '', title: '' },
  defaults: { mock: 'dashboard', url: 'app.example.com' },
  example: { vo: 'Open the forecast panel, and look at the confidence band. Then set the buffer from the planning menu.', props: { url: 'app.example.com/plan', mock: 'dashboard', callouts: [{ x: 0.27, y: 0.2, w: 0.7, h: 0.44, label: 'Confidence band', say: 'confidence' }, { x: 0.02, y: 0.36, w: 0.2, h: 0.08, label: 'Planning', say: 'planning', click: true }] } },
};
const MOCKS = {
  dashboard: `<div class="mk mk-dash"><div class="side"><b></b><i></i><i class="on"></i><i></i><i></i><i></i></div><div class="main"><div class="top"><b></b><i></i></div><div class="kpis"><div><b></b><i></i></div><div><b></b><i></i></div><div><b></b><i></i></div></div><div class="chart"><svg viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0,95 C40,90 70,70 110,72 S180,50 220,48 S300,30 340,26 L400,18 L400,120 L0,120Z" fill="var(--accent-soft)"/><path d="M0,95 C40,90 70,70 110,72 S180,50 220,48 S300,30 340,26 L400,18" fill="none" stroke="var(--accent)" stroke-width="3"/></svg></div><div class="rows"><i></i><i></i><i></i></div></div></div>`,
  list: `<div class="mk mk-list"><div class="top"><b></b><i></i></div>${'<div class="row"><span></span><b></b><i></i></div>'.repeat(7)}</div>`,
  form: `<div class="mk mk-form"><b class="h"></b>${'<div class="f"><i></i><span></span></div>'.repeat(4)}<b class="btn"></b></div>`,
  doc: `<div class="mk mk-doc"><b class="h"></b>${'<i></i>'.repeat(4)}<b class="h2"></b>${'<i></i>'.repeat(5)}</div>`,
};
export const css = `
.b-browser .stage2 { flex: 1; display: flex; align-items: center; justify-content: center; }
.b-browser .win { position: relative; width: 100%; aspect-ratio: 16 / 9.4; max-height: 100%; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 80px -30px rgb(0 0 0 / 0.35); }
.b-browser .chrome2 { flex: none; display: flex; align-items: center; gap: calc(12px * var(--u)); padding: calc(16px * var(--u)) calc(22px * var(--u)); border-bottom: calc(2px * var(--u)) solid var(--line); }
.b-browser .chrome2 i { width: calc(14px * var(--u)); height: calc(14px * var(--u)); border-radius: 50%; background: var(--line); }
.b-browser .url { margin-left: calc(20px * var(--u)); flex: 1; max-width: 55%; padding: calc(8px * var(--u)) calc(20px * var(--u)); border-radius: 999px; background: var(--bg-2); font-family: var(--cf-mono); font-size: calc(24px * var(--u)); color: var(--dim); }
.b-browser .page { position: relative; flex: 1; overflow: hidden; }
.b-browser .cam { position: absolute; inset: 0; }
.b-browser .page img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
.b-browser .callout { position: absolute; padding: calc(12px * var(--u)) calc(20px * var(--u)); border-radius: calc(12px * var(--u)); background: var(--accent); color: var(--accent-ink); font-weight: 650; font-size: calc(28px * var(--u)); white-space: nowrap; z-index: 25; }
.mk { position: absolute; inset: 0; background: var(--surface); }
.mk b, .mk i, .mk span { display: block; border-radius: calc(8px * var(--u)); background: color-mix(in oklab, var(--ink) 9%, transparent); }
.mk-dash { display: grid; grid-template-columns: 22% 1fr; }
.mk-dash .side { border-right: calc(2px * var(--u)) solid var(--line); padding: 6%; display: flex; flex-direction: column; gap: 7%; }
.mk-dash .side b { height: 5%; width: 60%; background: var(--ink); opacity: 0.8; }
.mk-dash .side i { height: 4%; width: 80%; }
.mk-dash .side i.on { background: var(--accent-soft); }
.mk-dash .main { padding: 3% 4%; display: grid; grid-template-rows: auto auto 1fr auto; gap: 5%; }
.mk-dash .top { display: flex; justify-content: space-between; } .mk-dash .top b { width: 30%; height: calc(26px * var(--u)); background: var(--ink); opacity: 0.8; } .mk-dash .top i { width: 14%; height: calc(26px * var(--u)); }
.mk-dash .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3%; } .mk-dash .kpis div { border: calc(2px * var(--u)) solid var(--line); border-radius: calc(12px * var(--u)); padding: 8%; display: flex; flex-direction: column; gap: calc(10px * var(--u)); } .mk-dash .kpis b { height: calc(34px * var(--u)); width: 55%; background: var(--ink); opacity: 0.75; } .mk-dash .kpis i { height: calc(14px * var(--u)); width: 80%; }
.mk-dash .chart { border: calc(2px * var(--u)) solid var(--line); border-radius: calc(12px * var(--u)); padding: 2%; } .mk-dash .chart svg { width: 100%; height: 100%; display: block; }
.mk-dash .rows { display: flex; flex-direction: column; gap: calc(12px * var(--u)); } .mk-dash .rows i { height: calc(16px * var(--u)); }
.mk-list { padding: 3% 5%; display: flex; flex-direction: column; gap: 3%; } .mk-list .top { display: flex; justify-content: space-between; margin-bottom: 2%; } .mk-list .top b { width: 28%; height: calc(28px * var(--u)); background: var(--ink); opacity: 0.8; } .mk-list .top i { width: 12%; height: calc(28px * var(--u)); background: var(--accent); }
.mk-list .row { display: grid; grid-template-columns: calc(40px * var(--u)) 1fr 18%; gap: 3%; align-items: center; border-bottom: calc(2px * var(--u)) solid var(--line); padding-bottom: 2%; } .mk-list .row span { height: calc(40px * var(--u)); border-radius: 50%; } .mk-list .row b { height: calc(18px * var(--u)); width: 70%; } .mk-list .row i { height: calc(18px * var(--u)); }
.mk-form { padding: 5% 25%; display: flex; flex-direction: column; gap: 5%; } .mk-form .h { height: calc(34px * var(--u)); width: 50%; background: var(--ink); opacity: 0.8; } .mk-form .f { display: flex; flex-direction: column; gap: calc(10px * var(--u)); } .mk-form .f i { height: calc(14px * var(--u)); width: 30%; } .mk-form .f span { height: calc(52px * var(--u)); border: calc(2px * var(--u)) solid var(--line); background: transparent; } .mk-form .btn { height: calc(56px * var(--u)); width: 40%; background: var(--accent); }
.mk-doc { padding: 5% 18%; display: flex; flex-direction: column; gap: calc(16px * var(--u)); } .mk-doc .h { height: calc(40px * var(--u)); width: 60%; background: var(--ink); opacity: 0.8; margin-bottom: calc(10px * var(--u)); } .mk-doc .h2 { height: calc(28px * var(--u)); width: 40%; background: var(--ink); opacity: 0.6; margin-top: calc(18px * var(--u)); } .mk-doc i { height: calc(16px * var(--u)); } .mk-doc i:nth-child(3n) { width: 82%; }
`;
export function html(p) {
  const content = p.image ? `<img src="${esc(p.image)}" alt="">` : p.html ? p.html : MOCKS[p.mock] ?? MOCKS.dashboard;
  return `<div class="blk b-browser">${head(p)}<div class="stage2"><div class="win blk-card"><div class="chrome2"><i></i><i></i><i></i><span class="url">${esc(p.url ?? '')}</span></div><div class="page"><div class="cam">${content}</div></div></div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const page = el.querySelector('.page'), cam = kit.camera(el.querySelector('.cam'));
  kit.enter(el.querySelector('.win'), b.at(0.1), { y: 30, scale: 0.98, dur: 0.7 });
  const W = page.offsetWidth, H = page.offsetHeight;
  const spot = kit.spotlight(page, { pad: 10, radius: 14 });
  const cursor = kit.cursor(page);
  const cs = p.callouts ?? [];
  cs.forEach((c, i) => {
    const t = itemTime(ctx, c, i, cs.length, { from: 0.1, to: 0.8 });
    const rect = { x: c.x * W, y: c.y * H, w: c.w * W, h: c.h * H };
    const target = document.createElement('div');
    Object.assign(target.style, { position: 'absolute', left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
    el.querySelector('.cam').appendChild(target);
    spot.to(rect, t);
    if (c.label) {
      const lab = document.createElement('div');
      lab.className = 'callout';
      lab.innerHTML = md(c.label);
      page.appendChild(lab);
      const below = rect.y + rect.h + 70 < H;
      Object.assign(lab.style, { left: `${Math.min(rect.x, W - 420)}px`, top: `${below ? rect.y + rect.h + 22 : rect.y - 70}px` });
      tl.fromTo(lab, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', immediateRender: true }, t + 0.25);
      if (i < cs.length - 1) tl.to(lab, { opacity: 0, duration: 0.25 }, itemTime(ctx, cs[i + 1], i + 1, cs.length, { from: 0.1, to: 0.8 }) - 0.1);
    }
    if (c.click) { cursor.moveTo({ x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.55 }, t - 0.7, { dur: 0.65 }); cursor.click(t); }
    if (c.zoom) { cam.zoomTo(target, t + 0.2, { pad: 40, max: 2.2 }); cam.reset(i < cs.length - 1 ? itemTime(ctx, cs[i + 1], i + 1, cs.length) - 0.3 : b.end - 0.8); }
    sound('tick', t, { volume: 0.2 });
  });
  if (cs.length) spot.off(b.end - 0.5);
  finish(ctx, { driftTarget: el.querySelector('.stage2') });
}
