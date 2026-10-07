// Stage recipes: what an author means ("the CLI sends stop to the daemon, which waits for the
// child to exit") compiled into native elements with stable ids. The engine evaluates the
// elements; the recipe decides the choreography once, here, so every frame stays a pure
// function of time.
//
//   actors  [{id, label, kind, x, y, w, h, icon, status, at|say, detail}]
//   links   [{id, from, to, label, route: curve|straight|elbow, bend, dashed, at|say}]
//   events  [{do: send|pulse|highlight|state|move|show|hide|callout|burst|connect|disconnect|camera, at|say, …}]
//   code    {x, y, w, size, title, lines|before/after|commit+file, steps, focus, at|say}
//   ground  {material, colors, opacity}     a full-frame GPU material behind everything
//   under / elements / over                 raw native elements (canvas dialect)
//   camera  {x, y, zoom, keys: [{at|say, x, y, zoom, rotate, z, dur, ease}], focus}
import { codeElement } from './code.mjs';

export const ACTOR_KINDS = {
  service: 'server',
  database: 'database',
  user: 'user',
  users: 'users',
  queue: 'package',
  process: 'settings',
  external: 'cloud',
  file: 'file',
  client: 'laptop',
  phone: 'phone',
  timer: 'timer',
  lock: 'lock',
  note: 'message',
  state: 'target',
};
export const STATUS = { neutral: 'line', active: 'accent', added: 'positive', done: 'positive', removed: 'negative', error: 'negative', waiting: 'accent2' };
export const EVENTS = ['send', 'pulse', 'highlight', 'state', 'move', 'show', 'hide', 'callout', 'burst', 'connect', 'disconnect', 'camera'];
const STAGE_KEYS = ['actors', 'links', 'events', 'code', 'ground', 'under', 'elements', 'over', 'camera', 'shutter', 'samples', 'motion', 'z'];

const fail = (where, message) => {
  throw new Error(`${where}: ${message}`);
};

/** The point where a ray from a box's centre toward (dx, dy) leaves the box, plus a margin. */
function edgeGap(w, h, dx, dy, margin = 14) {
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [Math.abs(dx / len), Math.abs(dy / len)];
  const t = Math.min(ux > 1e-6 ? w / 2 / ux : Infinity, uy > 1e-6 ? h / 2 / uy : Infinity);
  return t + margin;
}

/** Where a stage's actors and code may sit: title-safe, below the heading, above the source line. */
export function stageArea(frame, { heading = true } = {}) {
  const tall = frame.height > frame.width, W = frame.width, H = frame.height;
  return { left: W * (tall ? 0.1 : 0.06), right: W * (tall ? 0.9 : 0.94), top: heading ? (tall ? 430 : 300) : (tall ? 200 : 120), bottom: H * (tall ? 0.88 : 0.86) };
}

const actorSize = a => {
  const label = String(a.label ?? a.id);
  return { w: a.w ?? Math.max(220, 120 + label.length * 17), h: a.h ?? (a.detail ? 132 : 104) };
};

/**
 * A stage drawn for a wide frame shown in a tall one would run off the side. Its actors are laid
 * down the frame instead: left-to-right order becomes top-to-bottom (move targets and camera keys
 * follow the same mapping), inside the stage area, below any code editor. Returns the spec to
 * compile and a note when it changed; a stage that already fits is left exactly as authored.
 */
export function fitStage(spec, frame, area) {
  const actors = spec.actors ?? [];
  if (frame.height <= frame.width || !actors.length) return { spec, note: null };
  const boxes = actors.map(a => ({ a, ...actorSize(a) }));
  const moves = (spec.events ?? []).filter(e => e?.do === 'move' && Number.isFinite(e.x));
  const right = Math.max(...boxes.map(b => b.a.x + b.w / 2), ...moves.map(e => e.x));
  const left = Math.min(...boxes.map(b => b.a.x - b.w / 2), ...moves.map(e => e.x));
  if (right <= frame.width && left >= 0) return { spec, note: null };
  const xs = [...boxes.map(b => b.a.x), ...moves.map(e => e.x)], ys = [...boxes.map(b => b.a.y), ...(spec.events ?? []).filter(e => e?.do === 'move' && Number.isFinite(e.y)).map(e => e.y)];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const maxW = Math.max(...boxes.map(b => b.w)), maxH = Math.max(...boxes.map(b => b.h));
  // With an editor on the same stage, the actors take the lower part of the area.
  const top = spec.code ? area.top + (area.bottom - area.top) * 0.55 : area.top, bottom = area.bottom;
  // A centred column: the authored spacing (capped at 420 px), never more than the area holds.
  const pad = maxH / 2 + 50, k = Math.min(1, (area.right - area.left - maxW) / Math.max(1, y1 - y0));
  const span = Math.min(bottom - top - 2 * pad, x1 - x0, 420 * Math.max(1, actors.length - 1)), mid = (top + bottom) / 2;
  // The axes swap: authored x (left to right) becomes y (top to bottom), authored y becomes x.
  const newX = y => Math.round(frame.width / 2 + (y - (y0 + y1) / 2) * k);
  const newY = x => Math.round(x1 > x0 ? mid - span / 2 + (x - x0) / (x1 - x0) * span : mid);
  // A point names only the axes it was authored with; an axis it left out stays where it is.
  const remap = p => {
    const [hasX, hasY] = [Number.isFinite(p.x), Number.isFinite(p.y)], [ox, oy] = [p.x, p.y];
    delete p.x; delete p.y;
    if (hasX) p.y = newY(ox);
    if (hasY) p.x = newX(oy);
  };
  const out = structuredClone(spec);
  for (const a of out.actors) remap(a);
  for (const e of out.events ?? []) if (e?.do === 'move' || (e?.do === 'camera' && !e.follow)) remap(e);
  for (const key of out.camera?.keys ?? []) remap(key);
  if (out.camera && (Number.isFinite(out.camera.x) || Number.isFinite(out.camera.y))) remap(out.camera);
  return { spec: out, note: `drawn for a wide frame; its ${actors.length} actors were laid down the tall frame in the same order. Give the stage tall positions for exact placement.` };
}

/**
 * Compile one stage spec into native elements and a camera. `cue(v, fallback)` turns seconds or
 * a spoken word into layer seconds; `end` is the layer length in seconds.
 */
export function compileStage(spec, { cue, end, where, frame, staged, root, heading = true, notes = [] }) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail(where, 'a stage is an object');
  for (const k of Object.keys(spec)) if (!STAGE_KEYS.includes(k) && !['title', 'kicker', 'source', 'support', 'land'].includes(k)) fail(where, `unknown stage key ${k} (${STAGE_KEYS.join(', ')})`);
  const area = stageArea(frame, { heading });
  const fitted = fitStage(spec, frame, area);
  if (fitted.note) notes.push(`${where}: ${fitted.note}`);
  spec = fitted.spec;
  const at = (v, fallback) => (v == null ? fallback : cue(v));
  const out = { under: [], actors: [], links: [], effects: [], over: [] };
  const cameraKeys = [];
  if (spec.ground) {
    const g = spec.ground;
    out.under.push({
      type: 'shader', id: 'ground', x: -frame.width * 0.1, y: -frame.height * 0.1, w: frame.width * 1.2, h: frame.height * 1.2,
      material: { name: g.material ?? 'noise', ...(g.colors ? { colors: g.colors } : {}), scale: g.scale ?? 1.4, amount: g.amount ?? 0.5, speed: g.speed ?? 0.6, seed: g.seed ?? 3 },
      opacity: g.opacity ?? 0.35, enter: 'fade', at: 0, dur: 0.8, z: g.z ?? 4,
    });
  }
  out.under.push(...structuredClone(spec.under ?? []), ...structuredClone(spec.elements ?? []));
  // Actors: a card with an icon, a label and a status light; the group carries the identity.
  const actors = new Map();
  (spec.actors ?? []).forEach((a, i) => {
    const w0 = `${where}.actors[${i}]`;
    if (!a?.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(a.id)) fail(w0, 'needs an id (a slug)');
    if (actors.has(a.id)) fail(w0, `duplicate actor ${a.id}`);
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) fail(w0, 'needs x and y (the card centre, in frame pixels)');
    const kind = a.kind ?? 'service';
    if (!(kind in ACTOR_KINDS)) fail(w0, `kind is ${Object.keys(ACTOR_KINDS).join(', ')}`);
    const label = String(a.label ?? a.id);
    if (label.length > 28) fail(w0, 'labels are at most 28 characters');
    const w = a.w ?? Math.max(220, 120 + label.length * 17),
      h = a.h ?? (a.detail ? 132 : 104);
    const appear = at(a.say ?? a.at, 0.2 + i * 0.15);
    const color = STATUS[a.status ?? 'neutral'] ?? 'line';
    const icon = a.icon ?? ACTOR_KINDS[kind];
    const card = { type: 'rect', id: `${a.id}.card`, x: -w / 2, y: -h / 2, w, h, r: 22, fill: 'surface', stroke: color, width: 3, enter: 'none', keys: [] };
    const dot = { type: 'circle', id: `${a.id}.status`, cx: w / 2 - 22, cy: -h / 2 + 22, r: 7, fill: color === 'line' ? 'muted' : color, enter: 'none', keys: [] };
    const children = [
      card,
      { type: 'icon', id: `${a.id}.icon`, name: icon, x: -w / 2 + 48, y: a.detail ? -14 : 0, size: 44, stroke: 'accent', enter: 'none' },
      { type: 'text', id: `${a.id}.label`, text: label, x: -w / 2 + 88, y: (a.detail ? -14 : 0) + 11, size: 32, font: 'strong', fill: 'ink', enter: 'none', fit: w - 120 },
      dot,
    ];
    if (a.detail) children.push({ type: 'text', id: `${a.id}.detail`, text: String(a.detail).slice(0, 40), x: -w / 2 + 28, y: 44, size: 22, font: 'mono', fill: 'muted', enter: 'none', fit: w - 56 });
    const group = { type: 'group', id: a.id, x: a.x, y: a.y, at: appear, enter: a.enter ?? 'pop', dur: a.dur, keys: [], children, ...(a.z != null ? { z: a.z } : {}) };
    actors.set(a.id, { spec: a, group, card, dot, w, h, appear, x: a.x, y: a.y });
    out.actors.push(group);
  });
  const actor = (id, w0) => actors.get(id) ?? fail(w0, `no actor ${id}`);
  // Links: connectors between actors that follow them as they move.
  const links = new Map();
  (spec.links ?? []).forEach((l, i) => {
    const w0 = `${where}.links[${i}]`;
    const [a, b] = [actor(l.from, w0), actor(l.to, w0)];
    const id = l.id ?? `${l.from}-${l.to}`;
    if (links.has(id)) fail(w0, `duplicate link ${id}`);
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    const appear = at(l.say ?? l.at, Math.max(a.appear, b.appear) + 0.35);
    const el = {
      type: 'connector', id, from: l.from, to: l.to, route: l.route ?? 'curve', bend: l.bend ?? (l.route === 'straight' ? 0 : 0.12),
      gapFrom: edgeGap(a.w, a.h, dx, dy), gapTo: edgeGap(b.w, b.h, -dx, -dy), stroke: l.color ?? 'muted', width: l.width ?? 4,
      arrow: l.arrow ?? 'end', at: appear, enter: 'draw', dur: 0.7, keys: [],
      ...(l.dashed ? { dash: [10, 12], loop: { type: 'dash', period: 1.6 } } : {}),
    };
    // A label rides above a level link and beside a steep one, so it never sits on the line.
    const steep = Math.abs(dy) > Math.abs(dx) * 1.2;
    const label = l.label ? { type: 'text', id: `${id}.label`, text: String(l.label).slice(0, 32), attach: { to: id, dx: steep ? 34 : 0, dy: steep ? 8 : -24 }, anchor: steep ? 'start' : 'middle', size: 24, font: 'mono', fill: 'muted', at: appear + 0.3, enter: 'fade' } : null;
    links.set(id, { spec: l, el, label, appear, from: l.from, to: l.to });
    out.links.push(el);
    if (label) out.links.push(label);
  });
  const findLink = (from, to, w0) => {
    for (const [id, l] of links) {
      if (l.from === from && l.to === to) return { id, forward: true };
      if (l.from === to && l.to === from) return { id, forward: false };
    }
    fail(w0, `no link between ${from} and ${to}; add one to links`);
  };
  let n = 0;
  for (const [i, ev] of (spec.events ?? []).entries()) {
    const w0 = `${where}.events[${i}]`;
    if (!EVENTS.includes(ev?.do)) fail(w0, `do is ${EVENTS.join(', ')}`);
    const t = at(ev.say ?? ev.at, null);
    if (t == null) fail(w0, 'needs at or say');
    if (t >= end) fail(w0, `is cued at ${t.toFixed(2)} s, after the stage ends (${end.toFixed(2)} s)`);
    const until = ev.untilSay != null || ev.until != null ? at(ev.untilSay ?? ev.until, null) : null;
    const id = ev.id ?? `${ev.do}-${++n}`;
    switch (ev.do) {
      case 'send': {
        if (!ev.via) [actor(ev.from, w0), actor(ev.to, w0)];
        const route = ev.via ? { id: ev.via, forward: ev.reverse !== true } : findLink(ev.from, ev.to, w0);
        if (!links.has(route.id)) fail(w0, `no link ${route.id}`);
        const dur = ev.dur ?? 1.0;
        const color = ev.color ?? 'accent2';
        out.effects.push({
          type: 'circle', id, cx: 0, cy: 0, r: ev.size ?? 13, fill: color, glow: { blur: 12, opacity: 0.9 },
          along: { path: route.id, at: t, dur, ease: ev.ease ?? 'inOut', from: route.forward ? 0 : 1, to: route.forward ? 1 : 0 },
          at: t, enter: 'pop', dur: 0.2, exitAt: t + dur, exit: 'fade', exitDur: 0.18,
        });
        if (ev.label) out.effects.push({ type: 'text', id: `${id}.label`, text: String(ev.label).slice(0, 24), attach: { to: id, dx: 0, dy: -30 }, anchor: 'middle', size: 24, font: 'mono', fill: 'ink', at: t, enter: 'fade', dur: 0.2, exitAt: t + dur, exit: 'fade', exitDur: 0.18 });
        const target = actor(route.forward ? links.get(route.id).to : links.get(route.id).from, w0);
        if (ev.arrive !== false) target.group.keys.push({ at: t + dur, scale: 1.06, dur: 0.12, ease: 'out' }, { at: t + dur + 0.12, scale: 1, dur: 0.35 });
        if (ev.burst) out.effects.push({ type: 'particles', id: `${id}.burst`, kind: 'burst', x: 0, y: 0, w: 0, h: 0, attach: { to: target.spec.id }, count: ev.burst === true ? 220 : ev.burst, velocity: 380, size: 3, gravity: 120, life: 1.1, fill: color, at: t + dur, enter: 'none' });
        break;
      }
      case 'pulse':
      case 'highlight': {
        const a = actor(ev.actor, w0);
        a.group.keys.push({ at: t, scale: 1.07, dur: 0.16, ease: 'out' }, { at: t + 0.16, scale: 1, dur: 0.4 });
        const color = ev.color ?? 'accent';
        a.card.keys.push({ at: t, stroke: color, dur: 0.25 });
        if (ev.do === 'pulse' || until != null) a.card.keys.push({ at: until ?? t + (ev.dur ?? 1.2), stroke: STATUS[a.spec.status ?? 'neutral'] ?? 'line', dur: 0.4 });
        break;
      }
      case 'state': {
        const a = actor(ev.actor, w0);
        if (!(ev.status in STATUS)) fail(w0, `status is ${Object.keys(STATUS).join(', ')}`);
        const color = STATUS[ev.status];
        a.card.keys.push({ at: t, stroke: color, dur: 0.35 });
        a.dot.keys.push({ at: t, fill: color === 'line' ? 'muted' : color, dur: 0.35 }, { at: t, scale: 1.6, dur: 0.15 }, { at: t + 0.15, scale: 1, dur: 0.3 });
        if (ev.status === 'removed') a.group.keys.push({ at: t + 0.2, opacity: 0.45, dur: 0.5 });
        if (ev.label) {
          const label = a.group.children.find(c => c.id === `${a.spec.id}.label`);
          label.exitAt = t;
          label.exit = 'fade';
          label.exitDur = 0.2;
          a.group.children.push({ ...label, id: `${a.spec.id}.label-${n}`, text: String(ev.label).slice(0, 28), at: t + 0.15, enter: 'fade', dur: 0.3, exitAt: undefined, exit: undefined });
        }
        break;
      }
      case 'move': {
        const a = actor(ev.actor, w0);
        if (!Number.isFinite(ev.x) && !Number.isFinite(ev.y)) fail(w0, 'move needs x and/or y (frame pixels)');
        a.group.keys.push({ at: t, ...(Number.isFinite(ev.x) ? { x: ev.x - a.x } : {}), ...(Number.isFinite(ev.y) ? { y: ev.y - a.y } : {}), dur: ev.dur ?? 1.0, ease: ev.ease ?? 'inOut' });
        break;
      }
      case 'show': {
        const a = actor(ev.actor, w0);
        a.group.at = t;
        a.appear = t;
        break;
      }
      case 'hide': {
        const a = actor(ev.actor, w0);
        Object.assign(a.group, { exitAt: t, exit: ev.exit ?? 'fade', exitDur: ev.dur ?? 0.4 });
        for (const l of links.values())
          if (l.from === ev.actor || l.to === ev.actor) {
            Object.assign(l.el, { exitAt: t, exit: 'fade', exitDur: ev.dur ?? 0.4 });
            if (l.label) Object.assign(l.label, { exitAt: t, exit: 'fade', exitDur: ev.dur ?? 0.4 });
          }
        break;
      }
      case 'connect': {
        const l = links.get(ev.link) ?? fail(w0, `no link ${ev.link}`);
        l.el.at = t;
        break;
      }
      case 'disconnect': {
        const l = links.get(ev.link) ?? fail(w0, `no link ${ev.link}`);
        Object.assign(l.el, { exitAt: t, exit: 'undraw', exitDur: ev.dur ?? 0.5 });
        if (l.label) Object.assign(l.label, { exitAt: t, exit: 'fade', exitDur: ev.dur ?? 0.5 });
        break;
      }
      case 'callout': {
        const a = actor(ev.actor, w0);
        const text = String(ev.text ?? '');
        if (!text.trim() || text.length > 60) fail(w0, 'callout text is 1–60 characters');
        const side = ev.side ?? 'top';
        const off = { top: [0, -(a.h / 2 + 90)], bottom: [0, a.h / 2 + 90], left: [-(a.w / 2 + 230), 0], right: [a.w / 2 + 230, 0] }[side] ?? fail(w0, 'side is top, bottom, left or right');
        const boxW = Math.max(180, 40 + text.length * 14.5),
          boxH = 64;
        // Keep the box inside the stage area wherever its actor stands (the leader still reaches the actor).
        const [bx, by] = [a.x + off[0] + (ev.dx ?? 0), a.y + off[1] + (ev.dy ?? 0)];
        const nudgeX = Math.max(area.left - (bx - boxW / 2), 0) + Math.min(area.right - (bx + boxW / 2), 0);
        const nudgeY = Math.max(area.top - (by - boxH / 2), 0) + Math.min(area.bottom - (by + boxH / 2), 0);
        off[0] += nudgeX; off[1] += nudgeY;
        const cid = `${id}`;
        const leave = until != null ? { exitAt: until, exit: 'fade', exitDur: 0.3 } : {};
        out.over.push({
          type: 'group', id: cid, x: 0, y: 0, attach: { to: a.spec.id, dx: off[0] + (ev.dx ?? 0), dy: off[1] + (ev.dy ?? 0) }, at: t, enter: 'pop', ...leave,
          children: [
            { type: 'rect', x: -boxW / 2, y: -boxH / 2, w: boxW, h: boxH, r: 16, fill: ev.fill ?? 'ink', enter: 'none' },
            { type: 'text', text, x: 0, y: 9, anchor: 'middle', size: 26, font: 'strong', fill: ev.fill === 'surface' ? 'ink' : 'bg', enter: 'none', fit: boxW - 28 },
          ],
        });
        out.over.push({ type: 'connector', id: `${cid}.leader`, from: cid, to: a.spec.id, route: 'straight', gapFrom: side === 'top' || side === 'bottom' ? boxH / 2 + 4 : boxW / 2 + 4, gapTo: edgeGap(a.w, a.h, -off[0], -off[1], 8), stroke: ev.fill ?? 'ink', width: 3, arrow: 'none', at: t + 0.1, enter: 'draw', dur: 0.35, ...leave });
        break;
      }
      case 'burst': {
        const a = actor(ev.actor, w0);
        out.effects.push({ type: 'particles', id, kind: 'burst', x: 0, y: 0, w: 0, h: 0, attach: { to: a.spec.id }, count: ev.count ?? 260, velocity: ev.velocity ?? 420, size: ev.size ?? 3.5, gravity: ev.gravity ?? 160, life: ev.life ?? 1.3, fill: ev.color ?? 'accent2', at: t, enter: 'none' });
        break;
      }
      case 'camera': {
        let { x, y } = ev;
        if (ev.follow) ({ x, y } = actor(ev.follow, w0));
        cameraKeys.push({ at: t, ...(Number.isFinite(x) ? { x } : {}), ...(Number.isFinite(y) ? { y } : {}), ...(Number.isFinite(ev.zoom) ? { zoom: ev.zoom } : {}), ...(Number.isFinite(ev.rotate) ? { rotate: ev.rotate } : {}), dur: ev.dur ?? 1.4, ease: ev.ease ?? 'inOut' });
        break;
      }
    }
  }
  // Keys must run in time order; events are authored in any order.
  for (const a of actors.values()) for (const el of [a.group, a.card, a.dot]) el.keys.sort((p, q) => p.at - q.at);
  // With no actors the code is the picture: by default it takes the stage area (wide, larger type,
  // an inline diff centred down it) instead of the corner an editor beside a diagram uses.
  const solo = spec.code && !(spec.actors?.length) ? (() => {
    // A tall frame's area is already inside its margins: there the editor takes all of its width,
    // at a size a phone reads, and long lines wrap (fitCode) rather than shrink.
    const tall = (frame?.height ?? 1080) > (frame?.width ?? 1920), aw = area.right - area.left, ah = area.bottom - area.top, size = tall ? 34 : 36;
    const lines = Math.max(...[spec.code.before, spec.code.after].map(t => (typeof t === 'string' ? t.split('\n').length : 0)));
    const h = lines ? (lines + 2.2) * size * 1.55 : 0;
    return { x: area.left + (tall ? 0 : aw * 0.08), w: aw * (tall ? 1 : 0.84), size, y: lines ? area.top + Math.max(0, (ah - h) * 0.4) : area.top + ah * 0.1 };
  })() : null;
  const code = spec.code ? [codeElement({ ...solo, ...spec.code }, { cue: v => at(v, null), where: `${where}.code`, staged, root, area })] : [];
  // Code read from git has no line count until it is fitted: on a tall frame, centre the fitted
  // editor down the stage as inline code is, rather than leave it near the top.
  if (solo && (frame?.height ?? 1080) > (frame?.width ?? 1920) && spec.code.y == null && !spec.code.before && !spec.code.after) {
    const el = code[0], rows = Math.max(...el.steps.map(st => st.show?.length ?? 0), 1);
    const h = el.size * (rows * (el.leading ?? 1.5) + (el.title ? 1.9 : 0) + 1.8);
    el.y = area.top + Math.max(0, (area.bottom - area.top - h) * 0.4);
  }
  const camera = spec.camera ? structuredClone(spec.camera) : {};
  if (camera.keys) camera.keys = camera.keys.map(k => ({ ...k, at: at(k.say ?? k.at, 0), say: undefined }));
  if (camera.focus?.keys) camera.focus.keys = camera.focus.keys.map(k => ({ ...k, at: at(k.say ?? k.at, 0), say: undefined }));
  if (cameraKeys.length) camera.keys = [...(camera.keys ?? []), ...cameraKeys].sort((p, q) => p.at - q.at);
  const elements = [...out.under, ...out.links, ...out.actors, ...code, ...out.effects, ...out.over, ...structuredClone(spec.over ?? [])];
  return { elements, camera: Object.keys(camera).length ? camera : null };
}
