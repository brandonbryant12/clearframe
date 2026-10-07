// A cast: a few designed objects that persist through a film and re-form as its idea develops
// (scattered, gathered into a line, circled, one stepping forward), instead of a new card per
// line. Formations are cued to spoken words and compiled once into keys on stable groups, so a
// frame stays a pure function of time. Each beat ends with every object's state; the next beat
// that names the cast starts exactly there, so the objects carry across the cut without a jump.
//
//   cast: {
//     objects: [{id, icon | word, color, label, size}],     first beat; later beats may add more
//     formations: [{form, say|at, ids, hero, word, center, spread, scale, dur, stagger, thread, beside,
//                   out, in, by}],
//   }
const check = (ok, message) => { if (!ok) throw new Error(`cast: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
export const FORMS = ['scatter', 'row', 'column', 'line', 'ring', 'cluster', 'hero', 'exit', 'swap', 'wave'];
const ENTERS = ['pop', 'drop', 'rise', 'left', 'right', 'fade', 'none'];
const COLORS = ['accent', 'accent2', 'positive', 'negative', 'ink', 'muted', 'surface'];
// A stable pseudo-random number in [0, 1) from text: the same cast always scatters the same way.
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; };

export function castSpec(input, known = new Map()) {
  own(input, ['objects', 'formations', 'seed'], 'cast');
  const objects = new Map(known);
  for (const [i, o] of (input.objects ?? []).entries()) {
    own(o, ['id', 'icon', 'word', 'color', 'label', 'size', 'float', 'enter'], `objects[${i}]`);
    check(o.enter == null || ENTERS.includes(o.enter), `objects[${i}].enter is ${ENTERS.join(', ')}`);
    check(typeof o.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(o.id), `objects[${i}].id is a lowercase slug`);
    check(!objects.has(o.id) || known.has(o.id), `objects[${i}].id ${o.id} is repeated`);
    check((o.icon == null) !== (o.word == null), `objects[${i}] is an icon or a word`);
    check(o.word == null || (typeof o.word === 'string' && o.word.trim() && o.word.length <= 14), `objects[${i}].word is up to 14 characters`);
    check(o.color == null || COLORS.includes(o.color), `objects[${i}].color is ${COLORS.join(', ')}`);
    check(o.label == null || (typeof o.label === 'string' && o.label.length <= 20), `objects[${i}].label is up to 20 characters`);
    check(o.size == null || (finite(o.size) && o.size >= 48 && o.size <= 360), `objects[${i}].size is 48–360 px`);
    objects.set(o.id, { color: 'accent', float: true, ...o });
  }
  check(objects.size >= 1 && objects.size <= 16, 'a cast has 1–16 objects (declare them in its first beat)');
  check(Array.isArray(input.formations) && input.formations.length >= 1 && input.formations.length <= 12, 'formations needs 1–12 entries');
  const formations = input.formations.map((f, i) => {
    own(f, ['form', 'say', 'at', 'ids', 'hero', 'word', 'center', 'spread', 'scale', 'dur', 'stagger', 'ease', 'thread', 'beside', 'out', 'in', 'by'], `formations[${i}]`);
    if (f.form === 'swap') check(objects.has(f.out) && objects.has(f.in) && f.out !== f.in, `formations[${i}] (swap) names out and in, two objects`);
    check(f.beside == null || objects.has(f.beside), `formations[${i}].beside names an object`);
    check(f.by == null || (f.form === 'swap' && Array.isArray(f.by) && f.by.every(id => objects.has(id) && id !== f.out && id !== f.in)),
      `formations[${i}].by lists the objects that cause a swap (only on swap)`);
    check(FORMS.includes(f.form), `formations[${i}].form is ${FORMS.join(', ')}`);
    check(f.say == null || (typeof f.say === 'string' && f.say.trim()), `formations[${i}].say is a word of the narration`);
    check(f.at == null || (finite(f.at) && f.at >= 0), `formations[${i}].at is seconds`);
    for (const id of f.ids ?? []) check(objects.has(id), `formations[${i}].ids names unknown object ${id}`);
    if (f.form === 'hero') check(objects.has(f.hero), `formations[${i}] (hero) names its hero object`);
    check(f.word == null || (typeof f.word === 'string' && f.word.length <= 24), `formations[${i}].word is up to 24 characters`);
    check(f.center == null || (Array.isArray(f.center) && f.center.length === 2 && f.center.every(finite)), `formations[${i}].center is [x, y] in frame pixels`);
    for (const k of ['spread', 'scale', 'dur', 'stagger']) check(f[k] == null || (finite(f[k]) && f[k] >= 0), `formations[${i}].${k} is a positive number`);
    return f;
  });
  return { objects, formations, seed: input.seed ?? 0 };
}

/** Where each object stands in one formation: {x, y, scale, rotate, opacity}. */
export function formationTargets(f, ids, frame, { size, seed = 0, current = new Map() }) {
  const { width: W, height: H } = frame, tall = H > W, u = Math.min(W, H);
  // `beside` sets the formation next to an object where it now stands, up and to its right.
  const near = f.beside != null ? current.get(f.beside) : null;
  const [cx, cy] = f.center ?? (near ? [near.x + size * (near.scale ?? 1) * 0.95, near.y - size * (near.scale ?? 1) * 0.75] : [W / 2, H / 2]);
  const spread = f.spread ?? u * 0.34, scale = f.scale ?? 1, n = ids.length, out = new Map();
  const place = (id, x, y, extra = {}) => out.set(id, { x, y, scale, rotate: 0, opacity: 1, ...extra });
  const form = f.form === 'line' ? (tall ? 'column' : 'row') : f.form;
  if (form === 'scatter') {
    // A sunflower spiral spread over the frame, jittered by the id: even coverage, never a grid.
    const rx = (tall ? W * 0.36 : W * 0.38) * (f.spread ? f.spread / (u * 0.34) : 1), ry = (tall ? H * 0.34 : H * 0.33) * (f.spread ? f.spread / (u * 0.34) : 1);
    const pts = ids.map((id, i) => {
      const r = Math.sqrt((i + 0.5) / n), a = i * 2.39996 + seed + hash(`${id}${seed}`) * 0.6;
      return [Math.cos(a) * r * rx, Math.sin(a) * r * ry];
    });
    // A few points of a spiral lean to one side; centre them so the pile sits in the frame's middle.
    const [mx, my] = [0, 1].map(k => pts.reduce((s, p) => s + p[k], 0) / n);
    ids.forEach((id, i) => place(id, cx + pts[i][0] - mx, cy + pts[i][1] - my, { rotate: (hash(`${id}r${seed}`) - 0.5) * 28, scale: scale * (0.85 + hash(`${id}s`) * 0.25) }));
  } else if (form === 'row' || form === 'column') {
    const along = form === 'row' ? Math.min(W * 0.84, size * 2 * n) : Math.min(H * 0.66, size * 1.9 * n);
    ids.forEach((id, i) => {
      const d = n === 1 ? 0 : -along / 2 + along * (i / (n - 1)) * (n - 1) / n + along / (2 * n);
      place(id, form === 'row' ? cx + d : cx, form === 'row' ? cy : cy + d);
    });
  } else if (form === 'ring') {
    ids.forEach((id, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; place(id, cx + Math.cos(a) * spread, cy + Math.sin(a) * spread); });
  } else if (form === 'cluster') {
    // Hexagonal packing outward from the centre: a pile of objects touching.
    const gap = size * 1.08 * scale, cells = [[0, 0]];
    for (let ring = 1; cells.length < n; ring++)
      for (let k = 0; k < 6 * ring && cells.length < n; k++) {
        const side = Math.floor(k / ring), step = k % ring, a0 = (side * Math.PI) / 3, a1 = ((side + 1) * Math.PI) / 3;
        const [x0, y0, x1, y1] = [Math.cos(a0) * ring, Math.sin(a0) * ring, Math.cos(a1) * ring, Math.sin(a1) * ring];
        cells.push([x0 + (x1 - x0) * (step / ring), y0 + (y1 - y0) * (step / ring)]);
      }
    ids.forEach((id, i) => place(id, cx + cells[i][0] * gap, cy + cells[i][1] * gap, { rotate: (hash(`${id}c`) - 0.5) * 12 }));
  } else if (form === 'hero') {
    // One object steps forward; the rest recede into a wide ring, small and quiet. The hero stands
    // centred (its word goes below), so it still holds the frame after the word has gone.
    const others = ids.filter(id => id !== f.hero), heroAt = [cx, cy - (f.word ? u * 0.08 : 0)];
    place(f.hero, heroAt[0], heroAt[1], { scale: (f.scale ?? 2.3) });
    others.forEach((id, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) / others.length) * Math.PI * 2;
      out.set(id, { x: cx + Math.cos(a) * (tall ? W * 0.4 : W * 0.42), y: cy + Math.sin(a) * (tall ? H * 0.36 : H * 0.4), scale: 0.6, rotate: 0, opacity: 0.35 });
    });
  } else if (form === 'swap') {
    // One becomes another in place: the old shrinks away where it stands, the new grows into its pose.
    const c = current.get(f.out) ?? { x: cx, y: cy, scale: 1, rotate: 0 };
    out.set(f.out, { x: c.x, y: c.y, scale: 0.01, rotate: c.rotate ?? 0, opacity: 0 });
    out.set(f.in, { x: c.x, y: c.y, scale: c.scale ?? 1, rotate: 0, opacity: 1 });
  } else if (form === 'exit') {
    // Each leaves along the line from the centre through where it stands, past the frame edge.
    ids.forEach(id => {
      const c = current.get(id) ?? { x: cx, y: cy }, dx = c.x - W / 2 || 1, dy = c.y - H / 2, d = Math.hypot(dx, dy) || 1, far = Math.hypot(W, H) * 0.7;
      out.set(id, { x: W / 2 + (dx / d) * far, y: H / 2 + (dy / d) * far, scale: c.scale ?? 1, rotate: (c.rotate ?? 0) + 20, opacity: 0 });
    });
  }
  return out;
}

/** The object as drawn: a group centred on its position (a tile with an icon, or a word on a pill). */
function objectElement(o, id, size, base, enter) {
  const s = o.size ?? size, children = [];
  if (o.word) {
    const w = Math.max(s * 1.4, o.word.length * s * 0.36 + s * 0.6);
    children.push({ type: 'rect', id: `${id}-tile`, x: -w / 2, y: -s * 0.36, w, h: s * 0.72, r: s * 0.36, fill: o.color, enter: 'none' },
      { type: 'text', id: `${id}-word`, text: o.word, x: 0, y: s * 0.13, size: s * 0.34, font: 'strong', fill: o.color === 'ink' ? 'bg' : 'ink', anchor: 'middle', fit: w - s * 0.4, enter: 'none' });
  } else {
    children.push({ type: 'rect', id: `${id}-tile`, x: -s / 2, y: -s / 2, w: s, h: s, r: s * 0.26, fill: o.color, enter: 'none' },
      { type: 'icon', id: `${id}-icon`, name: o.icon, x: 0, y: 0, size: s * 0.52, stroke: o.color === 'surface' ? 'ink' : 'bg', enter: 'none' });
  }
  if (o.label) children.push({ type: 'text', id: `${id}-label`, text: o.label, x: 0, y: s * 0.5 + s * 0.34, size: Math.max(22, s * 0.2), font: 'semibold', fill: 'muted', anchor: 'middle', enter: 'none' });
  // The starting pose is a key at 0, so every later key is absolute (opacity and rotation never compound).
  return { type: 'group', id, x: base.x, y: base.y, shadow: true, children, ...enter,
    keys: [{ at: 0, scale: base.scale ?? 1, rotate: base.rotate ?? 0, opacity: base.opacity ?? 1, dur: 0 }],
    ...(o.float ? { loop: { type: 'float', period: 3.4 + hash(id) * 1.6, amount: 0.35 } } : {}) };
}

/**
 * Elements for one beat's cast, and the state it ends in. `state`: Map id → pose carried from the
 * previous beat; `cue(v)` resolves a word or seconds to beat time.
 */
export function castElements(spec, frame, { state = new Map(), threads = [], cue = v => (typeof v === 'number' ? v : 0) } = {}) {
  const u = Math.min(frame.width, frame.height), size = u * 0.15;
  const pose = new Map(state), groups = new Map(), elements = [], words = [], notes = [];
  // Draw order carries across cuts too: an object keeps its depth, new ones and anything acting on
  // another come forward.
  let carried = [], top = Math.max(0, ...[...state.values()].map(p => p.z ?? 0));
  // A carried object's group, created on first use where the last beat left it.
  const group = id => {
    if (!groups.has(id)) {
      const g = objectElement(spec.objects.get(id), `cast-${id}`, size, pose.get(id), { at: 0, enter: 'none' });
      groups.set(id, { el: g, base: pose.get(id) });
      elements.push(g);
    }
    return groups.get(id);
  };
  // Formation times: a spoken cue, explicit seconds, or (uncued) evenly after the previous one.
  const times = [];
  spec.formations.forEach((f, k) => times.push(f.say != null ? cue(f.say) : f.at ?? (k === 0 ? 0 : times[k - 1] + 1.6)));
  // A thread or word lasts until the next formation that moves the cast (a wave leaves it standing).
  const until = k => times.find((_, j) => j > k && spec.formations[j].form !== 'wave');
  // An object that has exited stays gone unless a formation names it again.
  const alive = id => !pose.get(id)?.gone;
  spec.formations.forEach((f, k) => {
    const t = times[k], stagger = f.stagger ?? 0.06, dur = f.dur ?? 1.1;
    const ids = f.form === 'swap' ? [f.out, f.in] : f.ids ?? [...spec.objects.keys()].filter(id => alive(id) && (f.form !== 'exit' || pose.has(id)));
    // A wave runs through the objects in order where they stand, each lifting as it passes: a
    // sequence playing, a signal travelling. Nothing moves for good.
    if (f.form === 'wave') {
      ids.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const { el, base } = group(id), p = pose.get(id), at = t + i * (f.stagger ?? 0.16), s = p.scale ?? 1, x = p.x - base.x, y = p.y - base.y;
        el.keys.push({ at, x, y: y - size * 0.22 * (f.scale ?? 1), scale: s * 1.16, dur: 0.2, ease: 'out' }, { at: at + 0.2, x, y, scale: s, dur: 0.34, ease: 'spring' });
      });
      return;
    }
    // What causes a swap acts first: each `by` object travels onto the one that changes and works
    // at it (a pencil scribbles), and the change lands on the cue.
    if (f.form === 'swap' && f.by?.length && pose.has(f.out)) {
      const c = pose.get(f.out), reach = size * (c.scale ?? 1) * 0.4, from = Math.max(k ? times[k - 1] + 0.2 : 0, t - 1.2);
      f.by.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const { el, base } = group(id), x = c.x + reach * (i % 2 ? -1 : 1) - base.x, y = c.y - reach - base.y, s = pose.get(id).scale ?? 1;
        el.keys.push({ at: from, x, y, scale: s, rotate: -18, dur: Math.max(0.2, Math.min(0.6, t - from - 0.45)), ease: 'inOut' },
          { at: t - 0.42, rotate: -4, y: y + 6, dur: 0.12 }, { at: t - 0.28, rotate: -22, y, dur: 0.12 }, { at: t - 0.14, rotate: -8, y: y + 6, dur: 0.12 },
          { at: t, rotate: -18, y, dur: 0.2 });
        pose.set(id, { ...pose.get(id), x: base.x + x, y: base.y + y, rotate: -18 });
      });
      // The one being changed gives under each stroke.
      const { el, base } = group(f.out), s0 = c.scale ?? 1, [x, y] = [c.x - base.x, c.y - base.y];
      for (const [dt, k] of [[0.42, 0.95], [0.28, 1.02], [0.14, 0.95]]) el.keys.push({ at: t - dt, x, y, scale: s0 * k, dur: 0.12 });
    }
    const targets = formationTargets(f, ids, frame, { size, seed: spec.seed + k, current: pose });
    [...targets.keys()].forEach((id, i) => {
      const to = targets.get(id), at = Math.max(0, t + i * stagger), o = spec.objects.get(id);
      if (!groups.has(id)) {
        const from = pose.get(id);
        // Carried objects stand where the last beat left them; new ones arrive in place, on the cue.
        // `enter: 'none'` stands on frame one: the establishing picture is there before anything moves.
        const g = objectElement(o, `cast-${id}`, size, from ?? to, from || o.enter === 'none' ? { at: 0, enter: 'none' } : { at, enter: o.enter ?? 'pop', dur: o.enter && o.enter !== 'pop' ? 0.8 : 0.5, ...(o.enter && o.enter !== 'pop' && o.enter !== 'fade' ? { dist: size * 4 } : {}) });
        groups.set(id, { el: g, base: from ?? to });
        elements.push(g);
        if (!from) { pose.set(id, { ...to, z: ++top }); return; }
      }
      const { el, base } = groups.get(id);
      el.keys.push({ at, x: to.x - base.x, y: to.y - base.y, scale: to.scale, rotate: to.rotate, opacity: to.opacity, dur, ease: f.ease ?? 'inOut' });
      pose.set(id, { ...to, z: pose.get(id)?.z ?? ++top, gone: f.form === 'exit' || (f.form === 'swap' && id === f.out) });
    });
    // What causes a swap is drawn over what it changed.
    for (const id of f.form === 'swap' ? f.by ?? [] : []) if (pose.has(id)) pose.set(id, { ...pose.get(id), z: ++top });
    // A thread drawn through the formation once it settles: the pieces are now one sequence. Each
    // segment draws only after both its ends have arrived. If the beat ends before the formation can
    // settle, there is no thread (and none carried): drawing it early would show the line before
    // the pieces it joins, so the author is told to cue the move earlier or lengthen the beat.
    if (f.thread) {
      const pts = [...targets.entries()].map(([, p], i) => ({ ...p, settle: t + i * stagger + dur })).filter(p => p.opacity > 0);
      const segments = pts.slice(1).map((b, j) => ({ a: pts[j], b, at: Math.max(b.settle, pts[j].settle, t + dur + j * 0.12) }));
      const last = segments.at(-1)?.at ?? 0;
      if (frame.duration && last + 0.35 > frame.duration - 0.1)
        notes.push(`the thread of formation ${k + 1} (${f.form}${f.say ? ` on "${f.say}"` : ''}) would finish ${(last + 0.35 - frame.duration).toFixed(2)} s after the beat ends, so it is left out; cue the formation earlier or add tail`);
      else {
        segments.forEach(({ a, b, at }, j) => {
          const d = Math.hypot(b.x - a.x, b.y - a.y) || 1, inset = (size * 0.5 + 14) / d;
          words.push({ type: 'line', id: `cast-thread-${k}-${j + 1}`, x1: a.x + (b.x - a.x) * inset, y1: a.y + (b.y - a.y) * inset, x2: b.x - (b.x - a.x) * inset, y2: b.y - (b.y - a.y) * inset,
            stroke: 'ink', width: 3, cap: 'round', at, enter: 'draw', dur: 0.35, ...(until(k) != null ? { exitAt: until(k), exit: 'fade' } : {}) });
        });
        if (until(k) == null) carried = words.filter(w => w.id.startsWith(`cast-thread-${k}-`)).map(({ type, x1, y1, x2, y2, stroke, width, cap }) => ({ type, x1, y1, x2, y2, stroke, width, cap }));
      }
    }
    if (f.form === 'hero' && f.word) {
      const h = targets.get(f.hero), heroSize = size * (f.scale ?? 2.3);
      words.push({ type: 'text', id: `cast-word-${k}`, text: f.word, x: h.x, y: h.y + heroSize * 0.95, size: u * 0.085,
        font: 'display', fill: 'ink', anchor: 'middle', at: t + dur * 0.6, enter: 'type', fit: frame.width * 0.8,
        // With nothing to replace it, the word leaves before the cut rather than on it.
        ...(until(k) != null ? { exitAt: until(k), exit: 'fade' } : frame.duration > t + dur + 1.2 ? { exitAt: frame.duration - 0.4, exit: 'fade' } : {}) });
    }
  });
  // The last beat's settled thread stays until this beat's first move, then fades.
  const first = until(-1);
  threads.forEach((l, i) => words.unshift({ ...l, id: `cast-thread-in-${i}`, at: 0, enter: 'none', ...(first != null ? { exitAt: Math.max(0.01, first), exit: 'fade' } : {}) }));
  // Objects carried in that no formation moves this beat still stand where they were.
  for (const [id, p] of state) {
    if (groups.has(id) || p.gone || !spec.objects.has(id)) continue;
    const g = objectElement(spec.objects.get(id), `cast-${id}`, size, p, { at: 0, enter: 'none' });
    groups.set(id, { el: g, base: p });
    elements.unshift(g);
  }
  for (const { el } of groups.values()) el.keys.sort((a, b) => a.at - b.at);
  const depth = new Map([...groups].map(([id, { el }]) => [el, pose.get(id)?.z ?? 0]));
  return { elements: [...elements].sort((a, b) => depth.get(a) - depth.get(b)).concat(words), state: pose, threads: carried, notes };
}

export function expandCastProps(input, frame, ctx = {}) {
  if (input?.cast == null) return input;
  const { cast, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'view', 'viewFrom', 'world'])
    check(rest[key] == null, `cannot combine cast with ${key} (a cast lays itself out for the frame)`);
  const spec = castSpec(cast, ctx.objects ?? new Map());
  const { elements, state, threads, notes } = castElements(spec, frame, { state: ctx.state, threads: ctx.threads, cue: ctx.cue });
  for (const n of notes) ctx.notes?.push(`${frame.beatId ?? 'cast'}: ${n}`);
  if (frame.beatId) {
    const prefix = el => { el.id = `${frame.beatId}-${el.id}`; for (const c of el.children ?? []) prefix(c); };
    elements.forEach(prefix);
  }
  if (ctx.carry) Object.assign(ctx.carry, { state, objects: spec.objects, threads });
  return { ...rest, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
