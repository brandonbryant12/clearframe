import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.4, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'System diagram — nodes in columns, curved connectors that draw in, packets flowing along them, focus on cue.',
  use: '"How it works": data flows, request paths, org handoffs. ≤ 8 nodes, ≤ 4 columns. Label edges only when needed.',
  props: { nodes: "[{ id, label, sub, icon, col, row, tone: 'accent'|'muted', say }]", edges: "[{ from, to, label, say }]", focus: "[{ id, say }]", packets: 'true — dots travel along drawn edges', kicker: '', title: '', source: '' },
  defaults: { packets: true },
  example: { vo: 'A request hits the gateway, is checked by auth, and then served from the cache — or, on a miss, from the database.', props: { title: 'Life of a request', nodes: [{ id: 'user', label: 'Client', icon: 'monitor-smartphone', col: 0, say: 'request' }, { id: 'gw', label: 'Gateway', icon: 'network', col: 1, say: 'gateway' }, { id: 'auth', label: 'Auth', icon: 'shield-check', col: 2, row: 0, say: 'auth' }, { id: 'cache', label: 'Cache', icon: 'zap', col: 3, row: 0, tone: 'accent', say: 'cache' }, { id: 'db', label: 'Database', icon: 'database', col: 3, row: 1, say: 'database' }], edges: [{ from: 'user', to: 'gw' }, { from: 'gw', to: 'auth' }, { from: 'auth', to: 'cache' }, { from: 'cache', to: 'db', label: 'on a miss' }], focus: [{ id: 'cache', say: 'served' }] } },
};
export const css = `
.b-flow .body { flex: 1; position: relative; }
.b-flow svg.edges { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.b-flow .node { position: absolute; display: flex; align-items: center; gap: calc(22px * var(--u)); padding: calc(30px * var(--u)) calc(36px * var(--u)); border-width: calc(3px * var(--u)); }
.b-flow .node .ic { color: var(--accent); flex: none; }
.b-flow .node .lab { font-size: calc(50px * var(--u)); font-weight: 620; letter-spacing: -0.025em; line-height: 1.05; }
.b-flow .node .sub { font-size: calc(30px * var(--u)); color: var(--ink-2); margin-top: calc(4px * var(--u)); }
.b-flow .node.accent { border-color: var(--accent); }
.b-flow .node.muted { opacity: 0.55; }
.b-flow .elabel { position: absolute; font-family: var(--cf-mono); font-size: calc(26px * var(--u)); color: var(--dim); background: var(--bg); padding: 0 calc(8px * var(--u)); transform: translate(-50%, -50%); white-space: nowrap; }
`;
export const html = (p) => `<div class="blk b-flow">${head(p)}<div class="body blk-body"><svg class="edges"></svg>${(p.nodes ?? []).map((n) => `<div class="node blk-card ${n.tone ?? ''}" data-id="${esc(n.id)}"><span class="ic"></span><div><div class="lab">${md(n.label)}</div>${n.sub ? `<div class="sub">${md(n.sub)}</div>` : ''}</div></div>`).join('')}</div></div>`;
export default async function (ctx) {
  const { el, b, kit, tl, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const uu = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const body = el.querySelector('.body'), W = body.offsetWidth, H = body.offsetHeight;
  const vertical = ctx.format === 'vertical';
  const nodes = p.nodes ?? [], byId = new Map();
  const cols = Math.max(...nodes.map((n) => n.col ?? 0)) + 1;
  const perCol = {};
  for (const n of nodes) (perCol[n.col ?? 0] ??= []).push(n);
  for (const n of nodes) { const icon = el.querySelector(`.node[data-id="${n.id}"] .ic`); if (n.icon) n._icon = await kit.icon(icon, n.icon, { size: 58 }); else icon.remove(); }
  for (const n of nodes) {
    const node = el.querySelector(`.node[data-id="${n.id}"]`);
    const list = perCol[n.col ?? 0], rows = Math.max(...list.map((x, i) => (x.row ?? i))) + 1;
    const ri = n.row ?? list.indexOf(n);
    const main = ((n.col ?? 0) + 0.5) / cols, cross = (ri + 0.5) / rows;
    const w = node.offsetWidth, h = node.offsetHeight;
    const cx = vertical ? cross * W : main * W, cy = vertical ? main * H : cross * H;
    Object.assign(node.style, { left: `${cx - w / 2}px`, top: `${cy - h / 2}px` });
    byId.set(n.id, { ...n, node, cx, cy, w, h });
  }
  const svg = body.querySelector('svg.edges');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  const NS = 'http://www.w3.org/2000/svg';
  const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
  const times = new Map(nodes.map((n, i) => [n.id, itemTime(ctx, n, i, nodes.length, { from: 0.02, to: 0.7 })]));
  for (const n of nodes) {
    const t = times.get(n.id), N = byId.get(n.id);
    kit.enter(N.node, t, { y: 16 });
    if (N._icon) kit.drawIcon(N._icon, t + 0.1, { dur: 0.5 });
    sound('pop', t + 0.05, { volume: 0.22 });
  }
  const packets = [];
  for (const [k, e] of (p.edges ?? []).entries()) {
    const A = byId.get(e.from), B = byId.get(e.to);
    if (!A || !B) { window.CF.warn(`flow: edge ${e.from} → ${e.to} references a missing node`); continue; }
    let x1, y1, x2, y2, d;
    const sameMain = vertical ? Math.abs(A.cy - B.cy) < 1 : Math.abs(A.cx - B.cx) < 1;
    if (vertical && !sameMain) { x1 = A.cx; y1 = A.cy + A.h / 2; x2 = B.cx; y2 = B.cy - B.h / 2; const m = (y1 + y2) / 2; d = `M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`; }
    else if (!vertical && !sameMain) { x1 = A.cx + A.w / 2; y1 = A.cy; x2 = B.cx - B.w / 2; y2 = B.cy; const m = (x1 + x2) / 2; d = `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}`; }
    else if (vertical) { x1 = A.cx + A.w / 2; y1 = A.cy; x2 = B.cx - B.w / 2; y2 = B.cy; d = `M${x1},${y1} L${x2},${y2}`; }
    else { x1 = A.cx; y1 = A.cy + A.h / 2; x2 = B.cx; y2 = B.cy - B.h / 2; d = `M${x1},${y1} L${x2},${y2}`; }
    const path = add('path', { d, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 3 * uu, 'stroke-linecap': 'round' });
    const len = path.getTotalLength(), end = path.getPointAtLength(len), pre = path.getPointAtLength(Math.max(0, len - 12 * uu));
    const ang = Math.atan2(end.y - pre.y, end.x - pre.x), hs = 14 * uu;
    const head2 = add('path', { d: `M${end.x - hs * Math.cos(ang - 0.5)},${end.y - hs * Math.sin(ang - 0.5)} L${end.x},${end.y} L${end.x - hs * Math.cos(ang + 0.5)},${end.y - hs * Math.sin(ang + 0.5)}`, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 3 * uu, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const t = cue(e.say, () => Math.max(times.get(e.from), times.get(e.to)) + 0.25 - b.start);
    kit.draw(path, t, { dur: 0.6 });
    tl.from(head2, { opacity: 0, duration: 0.2 }, t + 0.5);
    if (e.label) {
      const mid = path.getPointAtLength(len / 2);
      const lab = document.createElement('div');
      lab.className = 'elabel'; lab.textContent = e.label;
      Object.assign(lab.style, { left: `${mid.x}px`, top: `${mid.y}px` });
      body.appendChild(lab);
      tl.from(lab, { opacity: 0, duration: 0.4 }, t + 0.4);
    }
    if (p.packets) packets.push({ path, len, start: t + 0.7, k });
  }
  if (packets.length) {
    const dots = packets.map(() => add('circle', { r: 7 * uu, fill: 'var(--accent)', opacity: 0 }));
    window.CF.onFrame((time) => packets.forEach((pk, i) => {
      if (time < pk.start) { dots[i].setAttribute('opacity', 0); return; }
      const s = (((time - pk.start) * 260 * uu + pk.k * 97) % (pk.len + 120 * uu));
      if (s > pk.len) { dots[i].setAttribute('opacity', 0); return; }
      const q = pk.path.getPointAtLength(s);
      dots[i].setAttribute('cx', q.x); dots[i].setAttribute('cy', q.y); dots[i].setAttribute('opacity', 0.9);
    }));
  }
  for (const f of p.focus ?? []) {
    const N = byId.get(f.id);
    if (!N) continue;
    const t = cue(f.say, 1.5);
    tl.to(N.node, { borderColor: kit.color('--accent'), scale: 1.05, duration: 0.4, ease: 'power3.out' }, t);
    for (const other of byId.values()) if (other.id !== f.id) tl.to(other.node, { opacity: 0.45, duration: 0.4 }, t);
    sound('tick', t, { volume: 0.3 });
  }
  finish(ctx);
}
