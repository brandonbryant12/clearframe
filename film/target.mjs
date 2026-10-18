// Framing addressed to what is drawn: a camera rect given as `{on: ID | [IDs], pad, state}` instead
// of coordinates, resolved from the named elements' own geometry, padded and widened to the
// frame's aspect so nothing is stretched. Only geometry the compiler knows exactly is used: rects,
// circles, ellipses, lines, polygons, straight-segment paths, images, documents and groups of those
// (a receipt, an app, a breakdown's bar, a table cell). Text has no measured box before rendering,
// so a text target is refused with the container to frame instead; a curved path, or a rotated,
// scaled, tilted, depth-placed or looping element, is refused too.
// A target that moves (keys or a route) must say which state to frame: `start` (as authored) or
// `end` (where its keys leave it).

const finite = v => typeof v === 'number' && Number.isFinite(v);
// Key fields that change where an element is drawn. The native pose (canvas.rs) multiplies a key's
// `scale` with its `scaleX`/`scaleY`; turns, tilts and depth are not boxes this module can prove.
const MOVES = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'tiltX', 'tiltY'];
// Loops that move or resize what they loop (dash, blink and level leave the box alone).
const MOVING_LOOPS = ['spin', 'pulse', 'float', 'sway', 'orbit', 'rock'];
/** Why an element's drawn box is not its authored box, or null when it is. */
function unprovable(el) {
  if ((el.rotate ?? 0) !== 0) return 'is turned';
  if (el.scale != null && el.scale !== 1) return 'is scaled';
  if (el.z != null || el.depth != null) return 'is placed in depth';
  if (el.tilt != null) return 'is tilted';
  if (el.loop && MOVING_LOOPS.includes(el.loop.type)) return `moves in a ${el.loop.type} loop`;
  if ((el.keys ?? []).some(k => k.rotate != null || k.tiltX != null || k.tiltY != null)) return 'turns or tilts in its keys';
  return null;
}

/** Whether a view-like value asks for a target instead of coordinates. */
export const isTarget = v => v != null && typeof v === 'object' && !Array.isArray(v) && 'on' in v;

/** Check `{on, pad, state}`; `fail(message)` throws with the caller's context. */
export function targetSpec(v, where, fail = m => { throw new Error(m); }) {
  if (!isTarget(v)) fail(`${where} must be {on: an element id or [ids], pad?, state?}`);
  for (const k of Object.keys(v)) if (!['on', 'pad', 'state'].includes(k)) fail(`${where}: unsupported field ${k} (a target takes on, pad, state)`);
  const ids = Array.isArray(v.on) ? v.on : [v.on];
  if (!ids.length || ids.length > 8 || ids.some(id => typeof id !== 'string' || !id.trim())) fail(`${where}.on names 1–8 element ids`);
  if (v.pad != null && !(finite(v.pad) && v.pad >= 0 && v.pad <= 2)) fail(`${where}.pad is 0–2 (a fraction of the target's size added on every side; 0.15 by default)`);
  if (v.state != null && !['start', 'end'].includes(v.state)) fail(`${where}.state is "start" (as authored) or "end" (where its keys leave it)`);
  return { ids, pad: v.pad ?? 0.15, state: v.state ?? null };
}

/** Find an element by id anywhere in a list, with the offset its groups add. */
function find(list, id, dx = 0, dy = 0) {
  for (const el of list ?? []) {
    if (el.id === id) return { el, dx, dy };
    if (el.type === 'group') {
      const scaled = el.scale != null && el.scale !== 1;
      const hit = find(el.children, id, dx + (el.x ?? 0), dy + (el.y ?? 0));
      if (hit) {
        if (scaled || unprovable(el)) hit.inside = el.id ?? 'a group';
        if (el.keys?.some(k => MOVES.some(m => k[m] != null)) || el.along) hit.moving = el.id ?? 'a group';
        return hit;
      }
    }
  }
  return null;
}

/** The exact box of an element, in its group's coordinates; null for one with no known box. */
function box(el, where, fail) {
  const r = (x, y, w, h) => [x, y, x + w, y + h];
  switch (el.type) {
    case 'rect':
    case 'image':
    case 'document':
    case 'meter':
    case 'particles':
      return r(el.x ?? 0, el.y ?? 0, el.w, el.h);
    case 'spotlight':
      return el.w != null ? r(el.x ?? 0, el.y ?? 0, el.w, el.h) : [el.cx - el.r, el.cy - el.r, el.cx + el.r, el.cy + el.r];
    case 'circle':
      return [(el.cx ?? 0) - el.r, (el.cy ?? 0) - el.r, (el.cx ?? 0) + el.r, (el.cy ?? 0) + el.r];
    case 'ellipse':
      return [(el.cx ?? 0) - el.rx, (el.cy ?? 0) - el.ry, (el.cx ?? 0) + el.rx, (el.cy ?? 0) + el.ry];
    case 'line': {
      const half = (el.width ?? 2) / 2;
      return [Math.min(el.x1 ?? 0, el.x2) - half, Math.min(el.y1 ?? 0, el.y2) - half, Math.max(el.x1 ?? 0, el.x2) + half, Math.max(el.y1 ?? 0, el.y2) + half];
    }
    case 'path': {
      // A path of straight segments (M, L, H, V, Z) is exactly the box of its vertices (plus half
      // its stroke); a curve's control points only bound it, so a curved path is refused. The data
      // is read whole: every character must belong to a command or a number (signs, decimals and
      // exponents included), or the path is refused rather than boxed from part of it.
      if (/[CSQTAcsqta]/.test(el.d)) fail(`${where}: ${el.id ?? 'a path'} is curved; its exact box is not known here, so frame a shape around it`);
      const lex = /\s*,?\s*(?:([MLHVZmlhvz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?))/y;
      const tokens = [];
      let at = 0;
      const d = String(el.d).trim();
      while (at < d.length) {
        lex.lastIndex = at;
        const m = lex.exec(d);
        if (!m || m.index !== at || lex.lastIndex === at) fail(`${where}: ${el.id ?? 'a path'} has path data that cannot be read exactly at "${d.slice(at, at + 12).trim()}"`);
        tokens.push(m[1] ?? Number(m[2]));
        at = lex.lastIndex;
      }
      let cmd = null, x = 0, y = 0, sx = 0, sy = 0;
      const xs = [], ys = [];
      for (let i = 0; i < tokens.length; ) {
        if (typeof tokens[i] === 'string') { cmd = tokens[i++]; if (cmd === 'Z' || cmd === 'z') { x = sx; y = sy; } continue; }
        if (cmd == null || cmd === 'Z' || cmd === 'z') fail(`${where}: ${el.id ?? 'a path'} has a number with no command before it`);
        const n = () => { const v = tokens[i++]; if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${where}: ${el.id ?? 'a path'} has a ${cmd} without its numbers`); return v; };
        const rel = cmd === cmd.toLowerCase();
        if ('Mm'.includes(cmd)) { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
        else if ('Ll'.includes(cmd)) { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); }
        else if ('Hh'.includes(cmd)) x = (rel ? x : 0) + n();
        else if ('Vv'.includes(cmd)) y = (rel ? y : 0) + n();
        xs.push(x); ys.push(y);
      }
      if (!xs.length) fail(`${where}: ${el.id ?? 'a path'} has no points`);
      const half = el.stroke != null && el.stroke !== 'none' ? (el.width ?? 2) / 2 : 0;
      return [Math.min(...xs) - half, Math.min(...ys) - half, Math.max(...xs) + half, Math.max(...ys) + half];
    }
    case 'poly': {
      const xs = el.points.map(p => p[0]), ys = el.points.map(p => p[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    case 'group': {
      // A group's box is the union of its shapes. Its text and icons are taken to sit inside those
      // shapes (a card's words); any other child whose drawn box cannot be proved is refused by name,
      // never quietly left out of the union.
      const boxes = (el.children ?? []).map((c, i) => childBox(c, `${where}: the group ${el.id ?? ''}'s child ${c.id ?? `${c.type} ${i + 1}`}`, fail)).filter(Boolean);
      if (!boxes.length) fail(`${where}: the group ${el.id ?? ''} has no shapes with a known box (only text or icons); frame a rect or card inside it`);
      const [gx, gy] = [el.x ?? 0, el.y ?? 0];
      return [Math.min(...boxes.map(b => b[0])) + gx, Math.min(...boxes.map(b => b[1])) + gy, Math.max(...boxes.map(b => b[2])) + gx, Math.max(...boxes.map(b => b[3])) + gy];
    }
    case 'text':
      fail(`${where}: ${el.id} is text, which has no measured box before rendering; frame the card, row or group it sits in`);
      return null;
    default:
      fail(`${where}: ${el.id} is a ${el.type}, which has no exact box to frame; frame a rect, card or group`);
      return null;
  }
}
// Words and marks inside a card: text, icons and groups made only of them. They are the card's
// content, inside its shapes, and are not part of its box (stated, not approximated).
const content = c => ['text', 'icon', 'pointer'].includes(c.type) || (c.type === 'group' && (c.children ?? []).every(content));
function childBox(c, where, fail) {
  if (content(c)) return null;
  const why = unprovable(c) ?? ((c.keys ?? []).some(k => MOVES.some(m => k[m] != null)) || c.along ? 'moves (keys or a route)' : null)
    ?? (['solid', 'particles'].includes(c.type) ? `is a ${c.type}, whose exact box is not known here` : null);
  if (why) fail(`${where} ${why}, so the group's drawn box cannot be proved; frame a still shape inside it, or the group's own card`);
  return box(c, where, fail);
}

/** Where keys that only move and scale leave an element's box (for `state: "end"`). */
function moved(b, el, where, fail) {
  const keys = el.keys ?? [];
  const end = keys.reduce((e, k) => ({ ...e, ...Object.fromEntries(MOVES.filter(m => k[m] != null).map(m => [m, k[m]])) }), {});
  if (end.rotate) fail(`${where}: ${el.id} turns; frame a still element`);
  // As the native pose: a key's scale multiplies its scaleX and scaleY (each holds until changed).
  const sx = (end.scale ?? 1) * (end.scaleX ?? 1), sy = (end.scale ?? 1) * (end.scaleY ?? 1);
  if (sx === 0 || sy === 0) fail(`${where}: ${el.id} ends scaled to nothing; there is no box to frame`);
  const [ox, oy] = el.origin ?? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const dx = end.x ?? 0, dy = end.y ?? 0;
  const xs = [ox + (b[0] - ox) * sx + dx, ox + (b[2] - ox) * sx + dx], ys = [oy + (b[1] - oy) * sy + dy, oy + (b[3] - oy) * sy + dy];
  // A negative scale mirrors the box; its bounds are still the outer edges.
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * A camera rect [x, y, w, h] on the named elements: their union box, padded by `pad` of its size,
 * widened to the frame's aspect, never closer than `maxZoom` times. `elements` is everything the
 * beat can see (a world beat includes what earlier beats drew).
 */
export function targetRect(spec, elements, { width, height, where = 'view', fail = m => { throw new Error(m); }, maxZoom = 4 } = {}) {
  const boxes = spec.ids.map(id => {
    const hit = find(elements, id);
    if (!hit) fail(`${where}.on names "${id}", which no element of this beat${spec.world ? ' or its world' : ''} has`);
    const { el } = hit;
    if (hit.inside) fail(`${where}: ${id} is inside ${hit.inside}, which is scaled, turned or placed in depth; frame the group itself`);
    const why = unprovable(el);
    if (why) fail(`${where}: ${id} ${why}; its box on screen is not its authored box, so it cannot be framed exactly`);
    const moves = el.along != null || (el.keys ?? []).some(k => MOVES.some(m => k[m] != null)) || hit.moving;
    if (moves && spec.state == null) fail(`${where}: ${id} moves (keys or a route); say which state to frame with state: "start" (as authored) or "end" (where its keys leave it)`);
    if (moves && spec.state === 'end' && (el.along != null || hit.moving)) fail(`${where}: ${id} travels a route or moves with its group; only state: "start" can be framed`);
    let b = box(el, `${where}.on`, fail);
    if (moves && spec.state === 'end') b = moved(b, el, `${where}.on`, fail);
    return [b[0] + hit.dx, b[1] + hit.dy, b[2] + hit.dx, b[3] + hit.dy];
  });
  let [x0, y0, x1, y1] = [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
  const pw = (x1 - x0) * spec.pad, ph = (y1 - y0) * spec.pad;
  x0 -= pw; x1 += pw; y0 -= ph; y1 += ph;
  // Widen to the frame's aspect around the target's centre; never closer than maxZoom.
  const aspect = width / height, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = Math.max(x1 - x0, width / maxZoom), h = Math.max(y1 - y0, height / maxZoom);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [cx - w / 2, cy - h / 2, w, h].map(v => Math.round(v * 100) / 100);
}
