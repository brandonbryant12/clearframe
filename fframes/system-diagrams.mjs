// System diagrams compile to ordinary native canvas elements: editable, seek-safe and portable.
const check = (ok, why) => { if (!ok) throw new Error(`diagram: ${why}`); };
const object = (v, keys, where) => { check(v && typeof v === 'object' && !Array.isArray(v), `${where} must be an object`); for (const k of Object.keys(v)) check(keys.includes(k), `unknown ${where}.${k}`); };
const cueKeys = ['at', 'say', 'dur', 'exitAt', 'exitSay', 'exitDur'];
const timing = (v, at = 0) => ({ ...(v.say == null ? { at } : {}), ...Object.fromEntries(cueKeys.filter(k => v[k] != null).map(k => [k, v[k]])), ...(v.exitAt != null || v.exitSay != null ? { exit: 'fade' } : {}) });
const idRE = /^[a-z][a-z0-9-]{0,39}$/;
const colorOf = status => ({ added: 'positive', removed: 'negative', active: 'accent' }[status] ?? 'muted');
const status = n => check(['neutral', 'added', 'removed', 'active'].includes(n.status ?? 'neutral'), 'unsupported status');
export function diagramElements(input, { width = 1920, height = 1080 } = {}) {
  object(input, ['nodes', 'edges', 'direction'], 'diagram');
  const { nodes, edges = [], direction = 'auto' } = input;
  check(['auto', 'horizontal', 'vertical'].includes(direction), 'direction must be auto, horizontal or vertical');
  check(Array.isArray(nodes) && nodes.length >= 1 && nodes.length <= 6, 'use 1–6 nodes per shot');
  check(Array.isArray(edges) && edges.length <= 10, 'use at most 10 edges per shot');
  const vertical = direction === 'vertical' || direction === 'auto' && height >= width;
  const cols = vertical ? (nodes.length > 4 ? 2 : 1) : Math.min(3, nodes.length), rows = Math.ceil(nodes.length / cols), u = Math.min(width, height);
  const area = { x: width * .10, y: height * .24, w: width * .80, h: height * .58 };
  const nw = Math.min(u * .29, area.w / cols * .72), nh = Math.min(u * .17, area.h / rows * .65), size = Math.min(u * .037, nh * .26), placed = new Map();
  nodes.forEach((n, i) => {
    object(n, ['id', 'label', 'kind', 'x', 'y', 'status', ...cueKeys], `nodes[${i}]`);
    check(typeof n.id === 'string' && idRE.test(n.id) && !placed.has(n.id), 'node ids must be unique lowercase slugs');
    check(typeof n.label === 'string' && n.label.trim() && n.label.length <= 24, `${n.id} needs a label up to 24 characters`);
    check(['service', 'database', 'user', 'queue', 'state'].includes(n.kind ?? 'service'), `${n.id}: unsupported node kind`); status(n);
    check((n.x == null) === (n.y == null), `${n.id}: set both x and y`);
    for (const k of ['x', 'y']) if (n[k] != null) check(Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= 1, `${n.id}.${k} must be 0–1`);
    const x = area.x + nw / 2 + (area.w - nw) * (n.x ?? (cols === 1 ? .5 : (i % cols) / (cols - 1)));
    const y = area.y + nh / 2 + (area.h - nh) * (n.y ?? (rows === 1 ? .5 : Math.floor(i / cols) / (rows - 1)));
    placed.set(n.id, { ...n, x, y });
  });
  const elements = [], edgeIds = new Set();
  edges.forEach((e, i) => {
    object(e, ['id', 'from', 'to', 'label', 'status', ...cueKeys], `edges[${i}]`);
    const a = placed.get(e.from), b = placed.get(e.to), id = e.id ?? `${e.from}-${e.to}`;
    check(a && b && a !== b, 'edges need two different existing node ids');
    check(idRE.test(id) && !edgeIds.has(id), 'edge ids must be unique slugs'); edgeIds.add(id); status(e);
    check(e.label == null || typeof e.label === 'string' && e.label.length <= 24, `${id}: label must be up to 24 characters`);
    const across = Math.abs(b.x - a.x) > Math.abs(b.y - a.y), sign = Math.sign(across ? b.x - a.x : b.y - a.y);
    const ax = a.x + (across ? sign * (nw / 2 + 8) : 0), ay = a.y + (across ? 0 : sign * (nh / 2 + 8));
    const bx = b.x - (across ? sign * (nw / 2 + 8) : 0), by = b.y - (across ? 0 : sign * (nh / 2 + 8)), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const d = across ? `M ${ax} ${ay} H ${mx} V ${by} H ${bx}` : `M ${ax} ${ay} V ${my} H ${bx} V ${by}`;
    const when = timing(e, Math.max(a.at ?? 0, b.at ?? 0) + .35);
    elements.push({ type: 'path', id: `diagram-edge-${id}`, d, stroke: e.status ? colorOf(e.status) : 'accent', fill: 'none', width: u * .0035, arrow: 'end', head: u * .014, enter: 'draw', dur: .6, ...when });
    if (e.label) elements.push({ type: 'text', id: `diagram-edge-${id}-label`, text: e.label, x: mx + (across ? 0 : u * .025), y: my - u * .016, size: size * .8, fit: across ? Math.max(80, Math.abs(bx - ax) - 20) : u * .19, anchor: across ? 'middle' : 'start', fill: 'ink', font: 'mono', enter: 'fade', ...when });
  });
  for (const n of placed.values()) {
    const { x, y } = n, color = colorOf(n.status), left = x - nw / 2, top = y - nh / 2, children = [];
    if (n.kind === 'database') {
      const ry = nh * .13;
      children.push({ type: 'path', d: `M ${left} ${top + ry} C ${left} ${top - ry} ${left + nw} ${top - ry} ${left + nw} ${top + ry} V ${top + nh - ry} C ${left + nw} ${top + nh + ry} ${left} ${top + nh + ry} ${left} ${top + nh - ry} Z`, fill: 'surface', stroke: color, width: 3 }, { type: 'ellipse', cx: x, cy: top + ry, rx: nw / 2, ry, fill: 'none', stroke: color, width: 3 });
    } else children.push({ type: 'rect', x: left, y: top, w: nw, h: nh, r: n.kind === 'state' ? nh / 2 : 16, fill: 'surface', stroke: color, width: 3 });
    if (n.kind === 'user') children.push({ type: 'circle', cx: left + nw * .16, cy: y - nh * .10, r: nh * .11, fill: 'none', stroke: color, width: 3 }, { type: 'path', d: `M ${left + nw * .07} ${y + nh * .22} Q ${left + nw * .16} ${y - nh * .08} ${left + nw * .25} ${y + nh * .22}`, fill: 'none', stroke: color, width: 3 });
    if (n.kind === 'queue') for (let j = 0; j < 3; j++) children.push({ type: 'line', x1: left + nw * .12, y1: top + nh * (.28 + j * .21), x2: left + nw * .24, y2: top + nh * (.28 + j * .21), stroke: color, width: 3 });
    const icon = ['user', 'queue'].includes(n.kind);
    children.push({ type: 'text', text: n.label, x: x + (icon ? nw * .12 : 0), y: y + size * .34, size, fit: nw * (icon ? .63 : .85), anchor: 'middle', fill: 'ink', font: 'strong' });
    if (['added', 'removed'].includes(n.status)) children.push({ type: 'text', text: n.status === 'added' ? '+' : '−', x: left + nw - 9, y: top + size * .75, size: size * .7, anchor: 'end', fill: color, font: 'bold' });
    elements.push({ type: 'group', id: `diagram-node-${n.id}`, enter: 'fade', dur: .3, ...timing(n), children });
  }
  return elements;
}
