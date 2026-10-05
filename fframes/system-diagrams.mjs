// System diagrams: a small graph whose components keep their identity while the story changes
// it — additions, removals, replacements, status changes and requests travelling along the
// connections. One declaration explains a whole change without redrawing each beat. It compiles
// to ordinary native canvas elements (editable, seek-safe, portable); node and edge ids are
// stable (`diagram-node-<id>`, `diagram-edge-<id>`), so consecutive canvas beats that share
// them morph: a node slides to its new place instead of re-entering.
const check = (ok, why) => {
  if (!ok) throw new Error(`diagram: ${why}`);
};
const object = (v, keys, where) => {
  check(v && typeof v === 'object' && !Array.isArray(v), `${where} must be an object`);
  for (const k of Object.keys(v)) check(keys.includes(k), `unknown ${where}.${k}`);
};
const KINDS = ['service', 'database', 'user', 'queue', 'state', 'external'];
const STATUSES = ['neutral', 'active', 'added', 'removed', 'error'];
const COLOR = { neutral: 'muted', active: 'accent', added: 'positive', removed: 'negative', error: 'negative' };
const BADGE = { added: '+', removed: '−', error: '!' };
const CUES = ['at', 'say', 'dur', 'exitAt', 'exitSay', 'exitDur'];
const NODE_KEYS = ['id', 'label', 'kind', 'status', 'x', 'y', 'replaces', ...CUES];
const EDGE_KEYS = ['id', 'from', 'to', 'label', 'status', 'style', 'flow', ...CUES];
const STEP_KEYS = ['at', 'say', 'add', 'remove', 'replace', 'with', 'set', 'send', 'label', 'dur'];
const GROUP_KEYS = ['id', 'label', 'nodes'];
/** Seconds: node fade, connector draw, removal (marked, then gone), one request hop, add stagger. */
const TIME = { node: 0.35, edge: 0.6, remove: 0.8, hop: 0.75, stagger: 0.3, change: 0.3 };
export const DIAGRAM_LIMITS = { nodes: 8, edges: 12, steps: 12, groups: 3, label: 28 };
const idRE = /^[a-z][a-z0-9-]{0,39}$/;
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const r2 = v => Math.round(v * 100) / 100;

/**
 * Compile `canvas.props.diagram` to canvas elements for a frame of `width × height`.
 * `resolve(cue)` maps seconds or a spoken phrase to scene seconds (the job passes the beat's
 * resolver, so derived timing — connectors waiting for both ends, removals, request hops — is
 * exact). Without it, spoken cues count as 0 s and timing checks are skipped (validation only).
 */
export function diagramElements(input, { width = 1920, height = 1080, resolve } = {}) {
  object(input, ['nodes', 'edges', 'steps', 'groups', 'direction', 'area'], 'diagram');
  const { nodes, edges = [], steps = [], groups = [], direction = 'auto' } = input;
  const L = DIAGRAM_LIMITS;
  check(['auto', 'horizontal', 'vertical'].includes(direction), 'direction must be auto, horizontal or vertical');
  check(Array.isArray(nodes) && nodes.length >= 1 && nodes.length <= L.nodes, `use 1–${L.nodes} nodes per shot; split larger systems into shots`);
  check(Array.isArray(edges) && edges.length <= L.edges, `use at most ${L.edges} edges per shot`);
  check(Array.isArray(steps) && steps.length <= L.steps, `use at most ${L.steps} steps per shot`);
  check(Array.isArray(groups) && groups.length <= L.groups, `use at most ${L.groups} groups per shot`);
  const exact = typeof resolve === 'function';
  const time = v => (v == null ? null : exact ? resolve(v) : typeof v === 'number' ? v : 0);
  const cueOf = (v, where) => {
    check(v.at == null || v.say == null, `${where}: use at or say, not both`);
    check(v.exitAt == null || v.exitSay == null, `${where}: use exitAt or exitSay, not both`);
    for (const k of ['at', 'exitAt', 'dur', 'exitDur'])
      check(v[k] == null || (Number.isFinite(v[k]) && v[k] >= 0), `${where}.${k} must be a nonnegative number`);
    for (const k of ['say', 'exitSay']) check(v[k] == null || (typeof v[k] === 'string' && v[k].trim()), `${where}.${k} must be a spoken word or phrase`);
    return { at: time(v.at ?? v.say), exitAt: time(v.exitAt ?? v.exitSay) };
  };
  const statusOk = (s, where) => check(s == null || STATUSES.includes(s), `${where}: status must be ${STATUSES.join(', ')}`);

  // ---- the cast: nodes and edges with identities, lifetimes and status timelines
  const N = new Map();
  nodes.forEach((n, i) => {
    const where = `nodes[${i}]`;
    object(n, NODE_KEYS, where);
    check(typeof n.id === 'string' && idRE.test(n.id) && !N.has(n.id), `${where}: node ids must be unique lowercase slugs`);
    check(typeof n.label === 'string' && n.label.trim() && n.label.length <= L.label, `${n.id} needs a label up to ${L.label} characters`);
    check(KINDS.includes(n.kind ?? 'service'), `${n.id}: kind must be ${KINDS.join(', ')}`);
    statusOk(n.status, n.id);
    check((n.x == null) === (n.y == null), `${n.id}: set both x and y`);
    for (const k of ['x', 'y']) if (n[k] != null) check(Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= 1, `${n.id}.${k} must be 0–1`);
    N.set(n.id, { ...n, order: i, kind: n.kind ?? 'service', ...cueOf(n, n.id), timed: n.at != null || n.say != null, status: [[null, n.status]] });
  });
  const E = new Map(), pairs = new Set();
  edges.forEach((e, i) => {
    const where = `edges[${i}]`;
    object(e, EDGE_KEYS, where);
    const id = e.id ?? `${e.from}-${e.to}`;
    check(N.has(e.from) && N.has(e.to), `${id}: edges need existing node ids (from, to)`);
    check(typeof id === 'string' && idRE.test(id) && !E.has(id) && !N.has(id), `${where}: edge ids must be unique slugs, distinct from node ids`);
    check(e.label == null || (typeof e.label === 'string' && e.label.length <= L.label), `${id}: label must be up to ${L.label} characters`);
    check(['solid', 'dashed'].includes(e.style ?? 'solid'), `${id}: style must be solid or dashed`);
    check(e.flow == null || typeof e.flow === 'boolean', `${id}: flow must be true or false`);
    statusOk(e.status, id);
    E.set(id, { ...e, id, ...cueOf(e, id), timed: e.at != null || e.say != null, status: [[null, e.status]] });
    pairs.add(`${e.from}>${e.to}`);
  });
  const thing = id => N.get(id) ?? E.get(id);

  // ---- steps: changes to the same cast over time
  const sends = [];
  const scheduled = steps.map((s, i) => {
    object(s, STEP_KEYS, `steps[${i}]`);
    check((s.at == null) !== (s.say == null), `steps[${i}] needs at (seconds) or say (spoken cue)`);
    const ops = ['add', 'remove', 'replace', 'set', 'send'].filter(k => s[k] != null);
    check(ops.length === 1, `steps[${i}] takes exactly one of add, remove, replace, set, send`);
    check(s.with == null || s.replace != null, `steps[${i}].with belongs to replace`);
    check(s.label == null || s.send != null, `steps[${i}].label belongs to send`);
    check(s.dur == null || (s.send != null && Number.isFinite(s.dur) && s.dur >= 0.2 && s.dur <= 4), `steps[${i}].dur is the seconds per send hop, 0.2–4`);
    return { ...s, t: time(s.at ?? s.say), i };
  });
  scheduled.sort((a, b) => a.t - b.t || a.i - b.i);
  const enter = (id, t, where) => {
    const x = thing(id);
    check(x, `${where}: unknown id ${id}`);
    check(!x.timed && !x.stepped, `${where}: ${id} is already timed; cue it on the node/edge or in one step`);
    x.at = t;
    x.stepped = true;
    if (N.has(id)) x.status[0][1] ??= 'added';
  };
  const leave = (id, t, where) => {
    const x = thing(id);
    check(x, `${where}: unknown id ${id}`);
    check(x.exitAt == null, `${where}: ${id} already has an exit`);
    x.status.push([t, 'removed']);
    x.exitAt = t + TIME.remove;
  };
  for (const s of scheduled) {
    const where = `steps[${s.i}]`;
    if (s.add != null) list(s.add).forEach((id, k) => enter(id, s.t + k * TIME.stagger, where));
    if (s.remove != null) list(s.remove).forEach(id => leave(id, s.t, where));
    if (s.replace != null) {
      check(N.has(s.replace) && N.has(s.with), `${where}: replace needs existing node ids in replace and with`);
      leave(s.replace, s.t, where);
      enter(s.with, s.t + TIME.remove, where);
      const n = N.get(s.with);
      if (n.x == null && n.replaces == null) n.replaces = s.replace;
    }
    if (s.set != null) {
      object(s.set, [...N.keys(), ...E.keys()], `${where}.set`);
      for (const [id, status] of Object.entries(s.set)) {
        statusOk(status, `${where}.set.${id}`);
        thing(id).status.push([s.t, status]);
      }
    }
    if (s.send != null) {
      check(Array.isArray(s.send) && s.send.length >= 2 && s.send.every(id => N.has(id)), `${where}.send must list 2 or more node ids along connections`);
      sends.push({ path: s.send, t: s.t, label: s.label, hop: s.dur ?? TIME.hop, where });
    }
  }

  // ---- lifetimes: untimed nodes cascade in; connectors wait for both ends and leave with them
  let cascade = 0;
  for (const n of N.values()) {
    n.at ??= Math.min(1.2, cascade++ * 0.15);
    n.status[0][1] ??= 'neutral';
    if (exact && n.exitAt != null) check(n.exitAt >= n.at, `${n.id} exits before it appears`);
  }
  for (const e of E.values()) {
    const a = N.get(e.from), b = N.get(e.to), ready = Math.max(a.at, b.at) + TIME.node;
    e.at ??= ready;
    if (exact) check(e.at >= ready - 0.05, `${e.id} draws at ${e.at.toFixed(2)}s, before both ${e.from} and ${e.to} have appeared (${ready.toFixed(2)}s)`);
    const ends = [a.exitAt, b.exitAt].filter(v => v != null);
    if (ends.length) {
      const gone = Math.min(...ends);
      // A connector to a removed component is marked and leaves with it.
      if (e.exitAt == null) {
        e.exitAt = gone;
        const marked = [a, b].map(n => n.status.find(([t, s]) => t != null && s === 'removed')?.[0]).filter(v => v != null);
        if (marked.length) e.status.push([Math.min(...marked), 'removed']);
      } else if (exact) check(e.exitAt <= gone + 0.05, `${e.id} outlives ${a.exitAt === gone ? e.from : e.to}; a connector cannot dangle`);
    }
    // New wiring to a component added during the shot reads as added.
    e.status[0][1] ??= e.stepped || (!e.timed && [a, b].some(n => n.stepped && n.status[0][1] === 'added')) ? 'added' : 'neutral';
  }

  // ---- layout: slots (a replacement takes the replaced node's place), ranked along the edges
  const slotOf = id => {
    const seen = new Set();
    let n = N.get(id);
    while (n.replaces != null) {
      check(N.has(n.replaces) && !seen.has(n.id), `${n.id}.replaces must name another node`);
      seen.add(n.id);
      n = N.get(n.replaces);
    }
    return n.id;
  };
  for (const n of N.values()) {
    if (n.replaces == null) continue;
    check(n.replaces !== n.id && N.has(n.replaces), `${n.id}.replaces must name another node`);
    const old = N.get(n.replaces);
    check(n.x == null, `${n.id}: a replacement takes ${old.id}'s place; drop x and y`);
    if (exact) check(old.exitAt != null && n.at >= old.exitAt - 0.45, `${n.id} replaces ${old.id}, which must leave first (remove or replace it in a step)`);
  }
  const slots = [...new Set([...N.keys()].map(slotOf))];
  const links = [...E.values()].map(e => [slotOf(e.from), slotOf(e.to)]).filter(([a, b]) => a !== b);
  const rank = layerRanks(slots, links);
  const ranks = Math.max(...rank.values()) + 1;
  const byRank = Array.from({ length: ranks }, () => []);
  for (const s of slots) byRank[rank.get(s)].push(s);
  // One barycentre pass keeps connected nodes level with each other.
  const pos = new Map();
  byRank.forEach((row, r) => {
    if (r > 0) {
      const bary = s => {
        const preds = links.filter(([a, b]) => b === s && rank.get(a) < r).map(([a]) => pos.get(a));
        return preds.length ? preds.reduce((x, y) => x + y, 0) / preds.length : null;
      };
      const keyed = row.map((s, j) => ({ s, k: bary(s) ?? j }));
      keyed.sort((a, b) => a.k - b.k || N.get(a.s).order - N.get(b.s).order);
      row.splice(0, row.length, ...keyed.map(x => x.s));
    }
    row.forEach((s, j) => pos.set(s, j));
  });
  const across = direction === 'horizontal' || (direction === 'auto' && width > height);
  const widest = Math.max(...byRank.map(r => r.length));
  const u = Math.min(width, height);
  const box = input.area ?? [0.1, 0.24, 0.8, 0.58];
  check(Array.isArray(box) && box.length === 4 && box.every(v => Number.isFinite(v) && v >= 0 && v <= 1) && box[0] + box[2] <= 1.001 && box[1] + box[3] <= 1.001 && box[2] >= 0.2 && box[3] >= 0.2,
    'area must be [x, y, w, h] in 0–1 of the frame, at least 0.2 wide and tall');
  const area = { x: width * box[0], y: height * box[1], w: width * box[2], h: height * box[3] };
  const cols = across ? ranks : widest, rows = across ? widest : ranks;
  const nw = Math.min(u * 0.29, (area.w / cols) * (across ? 0.62 : 0.72)), nh = Math.min(u * 0.15, (area.h / rows) * (across ? 0.55 : 0.5));
  const size = Math.min(u * 0.034, nh * 0.27);
  check(nw >= u * 0.13 && nh >= u * 0.065,
    `${ranks} steps deep × ${widest} wide is too dense for this ${width}×${height} frame; split the shot, change direction, or widen area`);
  const hw = nw / 2, hh = nh / 2, gap = u * 0.008;
  // Text shrinks to fit its space, but never below the smallest size a phone can read (the
  // audit's floor): say so now, with the label, instead of after a render.
  const legible = u * 0.0195, em = { strong: 0.5, mono: 0.6 };
  const fits = (text, room, font) => text.length * em[font] * legible <= room;
  const roomOf = n => nw * (['user', 'queue'].includes(n.kind) ? 0.63 : 0.85);
  for (const n of N.values())
    check(fits(n.label, roomOf(n), 'strong'), `${n.id}: "${n.label}" cannot be read at this size (${Math.round(roomOf(n))} px wide); shorten it or put fewer components in a rank`);
  // Component names share one size: the largest at which the longest still fits.
  const nameSize = Math.max(legible, Math.min(size, ...[...N.values()].map(n => roomOf(n) / (n.label.length * 0.54))));
  const centre = new Map();
  for (const s of slots) {
    // Ranks run along the main axis; each rank is centred on a grid of `widest` lanes.
    const n = N.get(s), r = rank.get(s), lane = (widest - byRank[r].length) / 2 + pos.get(s);
    const main = ranks === 1 ? 0.5 : r / (ranks - 1), cross = widest === 1 ? 0.5 : lane / (widest - 1);
    const fx = n.x ?? (across ? main : cross), fy = n.y ?? (across ? cross : main);
    centre.set(s, { x: area.x + hw + (area.w - nw) * fx, y: area.y + hh + (area.h - nh) * fy });
  }
  const at = id => centre.get(slotOf(id));
  const life = id => {
    const members = [...N.values()].filter(n => slotOf(n.id) === id);
    return [Math.min(...members.map(n => n.at)), Math.max(...members.map(n => n.exitAt ?? Infinity))];
  };
  const rectOf = (c, pad = 0) => ({ l: c.x - hw - pad, r: c.x + hw + pad, t: c.y - hh - pad, b: c.y + hh + pad });
  const meets = (p, q) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++) {
      const [a0, a1] = life(slots[i]), [b0, b1] = life(slots[j]);
      if (a0 < b1 && b0 < a1 && meets(rectOf(centre.get(slots[i]), gap), rectOf(centre.get(slots[j]), gap)))
        check(false, `${slots[i]} and ${slots[j]} overlap on screen; move one (x, y) or let the auto layout place both`);
    }

  // ---- routing: orthogonal connectors with rounded corners. Connectors on one side of a
  // component spread into their own ports, elbows sharing a gap take separate channels (no
  // two lines share a run), self-transitions loop, and a connector detours around any
  // component on screen in its way.
  const routes = new Map(), plans = [];
  // Only components on screen while a connector is are in its way.
  const obstacles = e => slots
    .filter(s => s !== slotOf(e.from) && s !== slotOf(e.to))
    .filter(s => { const [s0, s1] = life(s); return s0 < (e.exitAt ?? Infinity) - 0.05 && e.at < s1 - 0.05; })
    .map(s => rectOf(centre.get(s), gap * 2));
  const blocked = (pts, others) => pts.some((q, i) => i && others.some(o => crosses(pts[i - 1], q, o)));
  for (const e of E.values()) {
    const a = at(e.from), b = at(e.to);
    if (slotOf(e.from) === slotOf(e.to)) {
      const lift = nh * 0.75, x0 = a.x - nw * 0.18, x1 = a.x + nw * 0.18, top = a.y - hh - gap;
      routes.set(e.id, { d: `M ${r2(x0)} ${r2(top)} C ${r2(x0)} ${r2(top - lift)} ${r2(x1)} ${r2(top - lift)} ${r2(x1)} ${r2(top)}`, pts: [[x0, top], [a.x, top - lift * 0.75], [x1, top]], label: { x: a.x, y: top - lift * 0.8 - size * 0.4, anchor: 'middle', fit: nw } });
      continue;
    }
    const horizontal = across ? Math.abs(b.x - a.x) > hw : !(Math.abs(b.y - a.y) > hh);
    const sx = Math.sign(b.x - a.x) || 1, sy = Math.sign(b.y - a.y) || 1;
    const p = { e, a, b, horizontal, sx, sy, twoWay: pairs.has(`${e.to}>${e.from}`), others: obstacles(e) };
    // A connector that would run through a component leaves over (or beside) it instead.
    const straight = horizontal ? [[a.x + sx * hw, a.y], [(a.x + b.x) / 2, a.y], [(a.x + b.x) / 2, b.y], [b.x - sx * hw, b.y]]
      : [[a.x, a.y + sy * hh], [a.x, (a.y + b.y) / 2], [b.x, (a.y + b.y) / 2], [b.x, b.y - sy * hh]];
    if (blocked(straight, p.others)) {
      const pts = detour(a, b, horizontal, p.others, { hw, hh, gap, area, lane: 0 });
      routes.set(e.id, { d: rounded(pts, u * 0.014), pts });
      continue;
    }
    const side = out => (horizontal ? ((sx > 0) === out ? 'r' : 'l') : (sy > 0) === out ? 'b' : 't');
    p.ends = [{ slot: slotOf(e.from), side: side(true), other: b }, { slot: slotOf(e.to), side: side(false), other: a }];
    plans.push(p);
  }
  // Ports: connectors on one side of a component spread along it, ordered by where they go;
  // connectors never on screen together can share a port.
  const sides = new Map();
  plans.forEach((p, i) => p.ends.forEach((end, k) => {
    const key = `${end.slot}:${end.side}`;
    (sides.get(key) ?? sides.set(key, []).get(key)).push({ end, i, k });
  }));
  const together = (m, n) => {
    const [x, y] = [plans[m.i].e, plans[n.i].e];
    return x.at < (y.exitAt ?? Infinity) - 0.05 && y.at < (x.exitAt ?? Infinity) - 0.05;
  };
  for (const [key, ports] of sides) {
    const upright = /[lr]$/.test(key), len = upright ? nh : nw;
    ports.sort((m, n) => (upright ? m.end.other.y - n.end.other.y : m.end.other.x - n.end.other.x) || m.i - n.i || n.k - m.k);
    for (const m of ports) {
      const live = ports.filter(n => n === m || together(m, n)), c = live.length, j = live.indexOf(m);
      const span = Math.min(len * 0.6, (c - 1) * len * 0.25);
      m.end.offset = c === 1 ? 0 : -span / 2 + (j * span) / (c - 1);
      m.end.alone = c === 1;
    }
  }
  // Components level with each other join with a straight line wherever one end is free to move.
  for (const p of plans) {
    const [s0, t0] = p.ends, level = Math.abs(p.horizontal ? p.a.y - p.b.y : p.a.x - p.b.x) < 1;
    if (level && t0.alone) t0.offset = s0.offset;
    else if (level && s0.alone) s0.offset = t0.offset;
  }
  const channels = new Map();
  for (const p of plans) {
    const { a, b, sx, sy, horizontal, ends: [s, t] } = p;
    p.ports = horizontal
      ? [[a.x + sx * (hw + gap), a.y + s.offset], [b.x - sx * (hw + gap), b.y + t.offset]]
      : [[a.x + s.offset, a.y + sy * (hh + gap)], [b.x + t.offset, b.y - sy * (hh + gap)]];
    const [p0, p1] = p.ports, main = horizontal ? 0 : 1, cross = 1 - main;
    if (Math.abs(p0[cross] - p1[cross]) < 1) continue;
    p.mid = (p0[main] + p1[main]) / 2;
    const key = `${horizontal}:${Math.round(p.mid / (u * 0.03))}`;
    (channels.get(key) ?? channels.set(key, []).get(key)).push(p);
  }
  const path = p => (p.mid == null ? p.ports : p.horizontal ? [p.ports[0], [p.mid, p.ports[0][1]], [p.mid, p.ports[1][1]], p.ports[1]] : [p.ports[0], [p.ports[0][0], p.mid], [p.ports[1][0], p.mid], p.ports[1]]);
  // Elbows sharing a gap each get their own run; try the orders and keep the fewest crossings.
  for (const list of channels.values()) {
    if (list.length < 2) continue;
    const main = list[0].horizontal ? 0 : 1, centre0 = list.reduce((x, p) => x + p.mid, 0) / list.length;
    const room = Math.min(...list.map(p => Math.abs(p.ports[1][main] - p.ports[0][main])));
    const step = Math.min(u * 0.024, (room * 0.6) / (list.length - 1));
    let best = null;
    for (const order of list.length > 5 ? [[...list.keys()]] : permutations([...list.keys()])) {
      order.forEach((idx, j) => { list[idx].mid = centre0 + (j - (list.length - 1) / 2) * step; });
      const cost = tangles(list.map(path));
      if (!best || cost < best.cost) best = { cost, mids: list.map(p => p.mid) };
    }
    list.forEach((p, j) => { p.mid = best.mids[j]; });
  }
  for (const p of plans) {
    const pts = path(p);
    routes.set(p.e.id, { d: rounded(pts, u * 0.014), pts, twoWay: p.twoWay, sign: Math.sign(p.ends[0].offset) });
  }
  // Group frames, then labels placed where they collide least with lines, components,
  // frames and each other.
  const frames = groups.map((g, i) => {
    object(g, GROUP_KEYS, `groups[${i}]`);
    check(typeof g.id === 'string' && idRE.test(g.id) && !N.has(g.id) && !E.has(g.id), `groups[${i}]: id must be a unique slug`);
    check(typeof g.label === 'string' && g.label.trim() && g.label.length <= L.label, `${g.id} needs a label up to ${L.label} characters`);
    check(Array.isArray(g.nodes) && g.nodes.length && g.nodes.every(id => N.has(id)), `${g.id}.nodes must list existing node ids`);
    const members = new Set(g.nodes.map(slotOf)), pad = u * 0.03, rs = [...members].map(m => rectOf(centre.get(m), pad));
    const box = { l: Math.min(...rs.map(q => q.l)), r: Math.max(...rs.map(q => q.r)), t: Math.min(...rs.map(q => q.t)) - size * 1.1, b: Math.max(...rs.map(q => q.b)) };
    for (const m of slots) if (!members.has(m)) check(!meets(box, rectOf(centre.get(m))), `${g.id} would enclose ${m}; place the group's nodes together (x, y) or split the shot`);
    return { g, box, pad };
  });
  const segments = [...routes.entries()].flatMap(([id, r]) => r.pts.slice(1).map((q, i) => ({ id, p: r.pts[i], q })));
  const boxes = slots.map(m => rectOf(centre.get(m), gap));
  const rims = frames.flatMap(({ box: b }) => [[[b.l, b.t], [b.r, b.t]], [[b.l, b.b], [b.r, b.b]], [[b.l, b.t], [b.l, b.b]], [[b.r, b.t], [b.r, b.b]]]);
  const placed = [];
  for (const e of E.values()) {
    const r = routes.get(e.id);
    if (r.label || !e.label) continue;
    const font = size * 0.78, width = e.label.length * em.mono * font;
    const others = segments.filter(x => x.id !== e.id);
    r.label = labelSpot(r.pts, { font, width, prefer: r.twoWay ? r.sign : 0 }, spot =>
      10 * others.filter(x => crosses(x.p, x.q, spot)).length + 10 * boxes.filter(b => meets(b, spot)).length +
      3 * rims.filter(([p, q]) => crosses(p, q, spot)).length + 6 * placed.filter(b => meets(b, spot)).length);
    placed.push(r.label.box);
    delete r.label.box;
  }
  for (const e of E.values())
    if (e.label) check(fits(e.label, routes.get(e.id).label.fit, 'mono'), `${e.id}: label "${e.label}" does not fit beside its ${Math.round(routes.get(e.id).label.fit)} px connector at a readable size; shorten or drop it`);

  // ---- elements: boundaries, connectors, requests, components (draw order)
  const out = [];
  for (const { g, box: frame, pad } of frames) {
    const start = Math.min(...g.nodes.map(id => N.get(id).at)), exits = g.nodes.map(id => N.get(id).exitAt);
    out.push({ type: 'group', id: `diagram-group-${g.id}`, at: Math.max(0, start - 0.1), enter: 'fade', dur: TIME.node,
      ...(exits.every(v => v != null) ? { exitAt: Math.max(...exits), exitDur: TIME.node } : {}),
      children: [
        { type: 'rect', x: r2(frame.l), y: r2(frame.t), w: r2(frame.r - frame.l), h: r2(frame.b - frame.t), r: u * 0.018, fill: 'none', stroke: 'line', width: u * 0.0022, dash: [u * 0.01, u * 0.008], enter: 'none' },
        { type: 'text', text: g.label, x: r2(frame.l + pad * 0.6), y: r2(frame.t + size * 0.95), size: size * 0.72, anchor: 'start', fill: 'muted', font: 'mono', upper: true, enter: 'none' },
      ] });
  }
  for (const e of E.values()) {
    const r = routes.get(e.id), dashed = e.style === 'dashed';
    const line = color => ({ type: 'path', d: r.d, stroke: color, fill: 'none', width: u * 0.0035, arrow: 'end', head: u * 0.014,
      ...(dashed || e.flow ? { dash: [u * 0.012, u * 0.009] } : {}) });
    const span = (t0, t1) => ({ at: t0, ...(t1 != null ? { exitAt: Math.max(t0, t1), exitDur: TIME.change } : {}) });
    out.push({ ...line(COLOR[e.status[0][1]]), id: `diagram-edge-${e.id}`, enter: dashed || e.flow ? 'fade' : 'draw', dur: TIME.edge, ...span(e.at, e.exitAt),
      ...(e.flow ? { loop: { type: 'dash', period: 1.4 } } : {}) });
    // A status change recolours the connector on top; the earlier colour goes once it has faded in.
    e.status.slice(1).forEach(([t, s], k, rest) => {
      const until = rest[k + 1]?.[0];
      out.push({ ...line(COLOR[s]), enter: 'fade', dur: TIME.change, ...(until != null ? { at: t, exitAt: until + TIME.change, exitDur: 0.01 } : span(t, e.exitAt)) });
    });
    if (e.label) out.push({ type: 'text', id: `diagram-edge-${e.id}-label`, text: e.label, ...r.label, size: size * 0.78, fill: 'ink', font: 'mono', enter: 'fade', dur: TIME.node, ...span(e.at + TIME.edge * 0.5, e.exitAt) });
  }
  // Requests: a token per hop that slips behind each component (it is "handled" there).
  const pulses = new Map(), late = [];
  for (const s of sends) {
    s.path.slice(1).forEach((to, k) => {
      const from = s.path[k], fwd = [...E.values()].find(e => e.from === from && e.to === to), back = !fwd && [...E.values()].find(e => e.from === to && e.to === from);
      check(fwd || back, `${s.where}.send: no connection between ${from} and ${to}`);
      const e = fwd || back, r = routes.get(e.id), pts = back ? [...r.pts].reverse() : r.pts, d = rounded(pts, u * 0.014);
      const t = s.t + k * s.hop, [x0, y0] = pts[0];
      if (exact) check(t >= e.at + TIME.edge - 0.05 && (e.exitAt == null || t + s.hop <= e.exitAt + 0.05), `${s.where}.send: ${e.id} is not on screen for the hop at ${t.toFixed(2)}s`);
      const ride = { at: t, enter: 'fade', dur: 0.12, exitAt: t + s.hop + 0.04, exitDur: 0.12, origin: [r2(x0), r2(y0)], along: { d, at: t, dur: s.hop, ease: 'inOut' } };
      out.push({ type: 'circle', cx: r2(x0), cy: r2(y0), r: u * 0.011, fill: 'accent', stroke: 'surface', width: u * 0.003, ...structuredClone(ride) });
      // The request slips behind each component (it is handled there); its name stays on top,
      // on the side away from connector labels.
      const flat = Math.abs(pts[1][1] - y0) < 1;
      // The name rides the first hop and clears before the handoff.
      if (s.label && k === 0) late.push({ type: 'text', text: s.label, x: r2(flat ? x0 : x0 - u * 0.022), y: r2(flat ? y0 + size * 1.25 : y0 + size * 0.3), size: size * 0.74, anchor: flat ? 'middle' : 'end', fill: 'accent', font: 'mono', ...structuredClone(ride), exitAt: t + s.hop * 0.8 });
      const arrival = t + s.hop;
      (pulses.get(to) ?? pulses.set(to, []).get(to)).push(arrival);
    });
  }
  for (const n of N.values()) {
    const c = at(n.id), draw = status => nodeShape(n, status, { hw, hh, nw, nh, size, nameSize, u });
    const children = draw(n.status[0][1]);
    // Each status change redraws the component on top, so the change reads as a change; the
    // earlier drawing goes once the next one has faded in over it.
    n.status.slice(1).forEach(([t, s], k, rest) => {
      const until = rest[k + 1]?.[0] ?? null;
      children.push({ type: 'group', at: t, enter: 'fade', dur: TIME.change, ...(until != null ? { exitAt: until + TIME.change, exitDur: 0.01 } : {}), children: draw(s) });
    });
    for (const t of pulses.get(n.id) ?? [])
      children.push({ type: 'rect', x: -hw - gap, y: -hh - gap, w: nw + gap * 2, h: nh + gap * 2, r: n.kind === 'state' ? hh + gap : u * 0.014, fill: 'none', stroke: 'accent', width: u * 0.004, enter: 'fade', at: t - 0.05, dur: 0.12, exitAt: t + 0.45, exitDur: 0.35 });
    out.push({ type: 'group', id: `diagram-node-${n.id}`, x: r2(c.x), y: r2(c.y), enter: 'fade', at: n.at, dur: TIME.node,
      ...(n.exitAt != null ? { exitAt: n.exitAt, exitDur: TIME.node } : {}), children });
  }
  return [...out, ...late];
}

/** Longest-path layers along the connections (back edges of cycles ignored), sources first. */
function layerRanks(slots, links) {
  const state = new Map(), post = [], kept = [];
  const incoming = new Set(links.map(([, b]) => b));
  const visit = s => {
    state.set(s, 1);
    for (const [a, b] of links)
      if (a === s) {
        if (state.get(b) === 1) continue;
        kept.push([a, b]);
        if (!state.has(b)) visit(b);
      }
    state.set(s, 2);
    post.push(s);
  };
  for (const s of [...slots.filter(s => !incoming.has(s)), ...slots]) if (!state.has(s)) visit(s);
  const rank = new Map(slots.map(s => [s, 0]));
  for (const s of post.reverse()) for (const [a, b] of kept) if (a === s) rank.set(b, Math.max(rank.get(b), rank.get(a) + 1));
  return rank;
}

/** Every order of a short list (channels hold a handful of connectors). */
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [x, ...rest]));
}

/** Crossings between orthogonal polylines, with shared runs counted as worse than a crossing. */
function tangles(lines) {
  const segs = lines.map(pts => pts.slice(1).map((q, i) => [pts[i], q]));
  let cost = 0;
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++)
      for (const [p, q] of segs[i])
        for (const [r, s] of segs[j]) {
          const ph = Math.abs(p[1] - q[1]) < 0.5, rh = Math.abs(r[1] - s[1]) < 0.5;
          if (ph !== rh) {
            const [h0, h1, v0, v1] = ph ? [p, q, r, s] : [r, s, p, q];
            const x = v0[0], y = h0[1];
            if (x > Math.min(h0[0], h1[0]) + 0.5 && x < Math.max(h0[0], h1[0]) - 0.5 && y > Math.min(v0[1], v1[1]) + 0.5 && y < Math.max(v0[1], v1[1]) - 0.5) cost += 1;
          } else if (ph ? Math.abs(p[1] - r[1]) < 2 : Math.abs(p[0] - r[0]) < 2) {
            const k = ph ? 0 : 1, lo = Math.max(Math.min(p[k], q[k]), Math.min(r[k], s[k])), hi = Math.min(Math.max(p[k], q[k]), Math.max(r[k], s[k]));
            if (hi - lo > 2) cost += 5;
          }
        }
  return cost;
}

/** Does the axis-aligned segment p→q pass through rect o? */
function crosses(p, q, o) {
  const l = Math.min(p[0], q[0]), r = Math.max(p[0], q[0]), t = Math.min(p[1], q[1]), b = Math.max(p[1], q[1]);
  return l < o.r && o.l < r && t < o.b && o.t < b;
}

/** Leave over (or beside) the components in the way, travel a clear lane, and come back in. */
function detour(a, b, horizontal, others, { hw, hh, gap, area, lane }) {
  const span = horizontal ? [Math.min(a.x, b.x), Math.max(a.x, b.x)] : [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inSpan = others.filter(o => (horizontal ? o.r > span[0] && o.l < span[1] : o.b > span[0] && o.t < span[1]));
  const clear = gap * 3;
  if (horizontal) {
    const above = Math.min(a.y - hh, b.y - hh, ...inSpan.map(o => o.t)) - clear, below = Math.max(a.y + hh, b.y + hh, ...inSpan.map(o => o.b)) + clear;
    const up = above >= area.y - hh * 0.6 || below > area.y + area.h + hh * 0.6;
    const y = up ? above : below, s = up ? -1 : 1;
    return [[a.x + lane, a.y + s * (hh + gap)], [a.x + lane, y], [b.x + lane, y], [b.x + lane, b.y + s * (hh + gap)]];
  }
  const left = Math.min(a.x - hw, b.x - hw, ...inSpan.map(o => o.l)) - clear, right = Math.max(a.x + hw, b.x + hw, ...inSpan.map(o => o.r)) + clear;
  const goLeft = left >= area.x - hw * 0.4 || right > area.x + area.w + hw * 0.4;
  const x = goLeft ? left : right, s = goLeft ? -1 : 1;
  return [[a.x + s * (hw + gap), a.y + lane], [x, a.y + lane], [x, b.y + lane], [b.x + s * (hw + gap), b.y + lane]];
}

/** Polyline path data with rounded interior corners. */
function rounded(pts, radius) {
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === pts.length - 1) {
      d += ` L ${r2(x)} ${r2(y)}`;
      break;
    }
    const [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
    const into = Math.hypot(x - px, y - py), out = Math.hypot(nx - x, ny - y), k = Math.min(radius, into / 2, out / 2);
    if (k < 0.5) {
      d += ` L ${r2(x)} ${r2(y)}`;
      continue;
    }
    const ax = x - ((x - px) / into) * k, ay = y - ((y - py) / into) * k, bx = x + ((nx - x) / out) * k, by = y + ((ny - y) / out) * k;
    d += ` L ${r2(ax)} ${r2(ay)} Q ${r2(x)} ${r2(y)} ${r2(bx)} ${r2(by)}`;
  }
  return d;
}

/**
 * Where a connector's label goes: above or below a horizontal run that holds it (text reads
 * along it), else beside a vertical run, choosing the spot that `clash(box)` scores lowest.
 * `prefer` 1 favours below/right (the second line of a two-way pair), -1 above/left.
 */
function labelSpot(pts, { font, width, prefer }, clash) {
  const spots = [];
  pts.slice(1).forEach((q, i) => {
    const p = pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (Math.abs(q[1] - p[1]) < 1) {
      if (len - 24 < width) return;
      for (const below of [false, true]) {
        const y = below ? my + font * 1.45 : my - font * 0.7;
        spots.push({ x: mx, y, anchor: 'middle', fit: Math.max(60, len - 24), box: { l: mx - width / 2, r: mx + width / 2, t: y - font * 0.8, b: y + font * 0.25 },
          bias: (below ? (prefer > 0 ? 0 : 1) : prefer > 0 ? 1 : 0) - len / 1e4 });
      }
    } else if (len > font * 2)
      for (const left of [false, true]) {
        const x = left ? mx - font * 0.6 : mx + font * 0.6, y = my + font * 0.3;
        spots.push({ x, y, anchor: left ? 'end' : 'start', fit: font * 12, box: { l: left ? x - width : x, r: left ? x : x + width, t: y - font * 0.8, b: y + font * 0.25 },
          bias: 2 + (left ? (prefer < 0 ? 0 : 0.5) : prefer < 0 ? 0.5 : 0) - len / 1e4 });
      }
  });
  if (!spots.length) {
    const [p, q] = [pts[0], pts.at(-1)], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - font * 0.7;
    spots.push({ x: mx, y: my, anchor: 'middle', fit: Math.max(60, Math.abs(q[0] - p[0]) - 24), box: { l: mx - width / 2, r: mx + width / 2, t: my - font * 0.8, b: my + font * 0.25 }, bias: 0 });
  }
  const best = spots.map(s => ({ s, cost: clash(s.box) + s.bias })).sort((a, b) => a.cost - b.cost)[0].s;
  return { x: r2(best.x), y: r2(best.y), anchor: best.anchor, fit: r2(best.fit), box: best.box };
}

/** One component drawn around (0, 0): its outline, kind mark, label and status badge. */
function nodeShape(n, status, { hw, hh, nw, nh, size, nameSize, u }) {
  const color = COLOR[status], stroke = u * 0.0028, out = [];
  if (n.kind === 'database') {
    const ry = nh * 0.13;
    out.push({ type: 'path', d: `M ${-hw} ${-hh + ry} C ${-hw} ${-hh - ry} ${hw} ${-hh - ry} ${hw} ${-hh + ry} V ${hh - ry} C ${hw} ${hh + ry} ${-hw} ${hh + ry} ${-hw} ${hh - ry} Z`, fill: 'surface', stroke: color, width: stroke },
      { type: 'ellipse', cx: 0, cy: -hh + ry, rx: hw, ry, fill: 'none', stroke: color, width: stroke });
  } else
    out.push({ type: 'rect', x: -hw, y: -hh, w: nw, h: nh, r: n.kind === 'state' ? hh : u * 0.012, fill: 'surface', stroke: color, width: stroke,
      ...(n.kind === 'external' ? { dash: [u * 0.01, u * 0.007] } : {}) });
  if (n.kind === 'user')
    out.push({ type: 'circle', cx: -hw + nw * 0.16, cy: -nh * 0.1, r: nh * 0.11, fill: 'none', stroke: color, width: stroke },
      { type: 'path', d: `M ${-hw + nw * 0.07} ${nh * 0.22} Q ${-hw + nw * 0.16} ${-nh * 0.08} ${-hw + nw * 0.25} ${nh * 0.22}`, fill: 'none', stroke: color, width: stroke });
  if (n.kind === 'queue')
    for (let j = 0; j < 3; j++) out.push({ type: 'line', x1: -hw + nw * 0.12, y1: -hh + nh * (0.28 + j * 0.21), x2: -hw + nw * 0.24, y2: -hh + nh * (0.28 + j * 0.21), stroke: color, width: stroke });
  const icon = ['user', 'queue'].includes(n.kind);
  out.push({ type: 'text', text: n.label, x: icon ? nw * 0.12 : 0, y: nameSize * 0.34, size: nameSize, fit: nw * (icon ? 0.63 : 0.85), anchor: 'middle', fill: 'ink', font: 'strong' });
  // A status badge sits on the outline's top-right, like a notification dot.
  if (BADGE[status]) {
    const r = size * 0.46, [cx, cy] = n.kind === 'state' ? [hw - hh * 0.3, -hh * 0.95] : n.kind === 'database' ? [hw, -hh + nh * 0.13] : [hw - 2, -hh + 2];
    out.push({ type: 'circle', cx, cy, r, fill: color, stroke: 'surface', width: u * 0.002 },
      { type: 'text', text: BADGE[status], x: cx, y: cy + r * 0.52, size: r * 1.5, anchor: 'middle', fill: 'surface', font: 'bold' });
  }
  // The base drawing arrives with its group; a change fades in as one piece.
  for (const el of out) el.enter = 'none';
  return out;
}
