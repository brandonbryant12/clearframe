// A cast: a few designed objects that persist through a film and re-form as its idea develops
// (scattered, gathered into a line, circled, one stepping forward), instead of a new card per
// line. Formations are cued to spoken words and compiled once into keys on stable groups, so a
// frame stays a pure function of time. Each beat ends with every object's state; the next beat
// that names the cast starts exactly there, so the objects carry across the cut without a jump.
//
//   cast: {
//     look: tiles | drawn | print,                          first beat; the cast keeps it
//     objects: [{id, icon | word, color, label, size}],     first beat; later beats may add more
//     formations: [{form, say|at, ids, hero, word, center, spread, scale, dur, stagger, thread, beside,
//                   out, in, by, mark, to, color}],
//   }
const check = (ok, message) => { if (!ok) throw new Error(`cast: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
export const FORMS = ['scatter', 'row', 'column', 'line', 'ring', 'cluster', 'hero', 'exit', 'swap', 'wave', 'mark', 'camera', 'fill', 'emerge', 'merge', 'split', 'travel'];
// The scene tone an object's colour floods the frame with when it fills it (docs/canvas.md, tone).
export const FILL_TONES = { accent: 'accent', accent2: 'accent2', surface: 'surface', ink: 'invert' };
export const LOOKS = ['tiles', 'drawn', 'print'];
const MARKS = ['circle', 'underline', 'cross', 'arrow'];
const ENTERS = ['pop', 'drop', 'rise', 'left', 'right', 'fade', 'none'];
const COLORS = ['accent', 'accent2', 'positive', 'negative', 'ink', 'muted', 'surface'];
// A stable pseudo-random number in [0, 1) from text: the same cast always scatters the same way.
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; };

export function castSpec(input, known = new Map(), knownLook = null) {
  own(input, ['objects', 'formations', 'seed', 'look'], 'cast');
  check(input.look == null || LOOKS.includes(input.look), `look is ${LOOKS.join(', ')}`);
  check(input.look == null || knownLook == null || input.look === knownLook, `look is set once, in the cast's first beat (it is ${knownLook})`);
  const objects = new Map(known);
  for (const [i, o] of (input.objects ?? []).entries()) {
    own(o, ['id', 'icon', 'word', 'shape', 'color', 'label', 'size', 'float', 'enter'], `objects[${i}]`);
    check(o.enter == null || ENTERS.includes(o.enter), `objects[${i}].enter is ${ENTERS.join(', ')}`);
    check(typeof o.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(o.id), `objects[${i}].id is a lowercase slug`);
    check(!objects.has(o.id) || known.has(o.id), `objects[${i}].id ${o.id} is repeated`);
    check([o.icon, o.word, o.shape].filter(v => v != null).length === 1, `objects[${i}] is one of an icon, a word or a shape`);
    check(o.shape == null || SHAPES[o.shape] != null, `objects[${i}].shape is ${Object.keys(SHAPES).join(', ')}`);
    check(o.word == null || (typeof o.word === 'string' && o.word.trim() && o.word.length <= 14), `objects[${i}].word is up to 14 characters`);
    check(o.color == null || COLORS.includes(o.color), `objects[${i}].color is ${COLORS.join(', ')}`);
    check(o.label == null || (typeof o.label === 'string' && o.label.length <= 20), `objects[${i}].label is up to 20 characters`);
    check(o.size == null || (finite(o.size) && o.size >= 48 && o.size <= 360), `objects[${i}].size is 48–360 px`);
    objects.set(o.id, { color: 'accent', float: true, ...o });
  }
  check(objects.size >= 1 && objects.size <= 16, 'a cast has 1–16 objects (declare them in its first beat)');
  check(Array.isArray(input.formations) && input.formations.length >= 1 && input.formations.length <= 12, 'formations needs 1–12 entries');
  const formations = input.formations.map((f, i) => {
    own(f, ['form', 'say', 'at', 'ids', 'hero', 'word', 'center', 'spread', 'scale', 'dur', 'stagger', 'ease', 'thread', 'beside', 'on', 'out', 'in', 'by', 'mark', 'to', 'color', 'zoom', 'into', 'from', 'via', 'trail'], `formations[${i}]`);
    if (f.form === 'mark') {
      check(MARKS.includes(f.mark) && Array.isArray(f.ids) && f.ids.length >= 1, `formations[${i}] (mark) is a ${MARKS.join(', ')} on ids`);
      check((f.mark === 'arrow') === (f.to != null) && [].concat(f.to ?? []).every(id => objects.has(id)), `formations[${i}]: an arrow mark points to another object or a list of them (to), and only an arrow does`);
    } else if (f.form === 'travel') {
      check(f.ids?.length >= 1 && ((f.to != null && objects.has(f.to) && !f.ids.includes(f.to)) !== (f.center != null)), `formations[${i}] (travel) moves ids to another object (to) or a point (center)`);
      check(f.via == null || (Array.isArray(f.via) && f.via.length <= 6 && f.via.every(v => Array.isArray(v) && v.length === 2 && v.every(finite))), `formations[${i}].via is up to 6 [x, y] waypoints in frame pixels`);
    } else check(f.mark == null && f.to == null, `formations[${i}]: mark and to belong to form mark (or travel)`);
    check(f.via == null && f.trail == null || f.form === 'travel', `formations[${i}]: via and trail belong to form travel`);
    check(f.color == null || COLORS.includes(f.color), `formations[${i}].color is ${COLORS.join(', ')}`);
    if (f.form === 'swap') check(objects.has(f.out) && objects.has(f.in) && f.out !== f.in, `formations[${i}] (swap) names out and in, two objects`);
    check(f.beside == null || objects.has(f.beside), `formations[${i}].beside names an object`);
    check(f.on == null || (objects.has(f.on) && f.beside == null && f.center == null && !(f.ids ?? []).includes(f.on)), `formations[${i}].on names another object to centre on (not with beside or center)`);
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
    check(f.form === 'camera' ? finite(f.zoom) && f.zoom >= 0.6 && f.zoom <= 2.5 : f.zoom == null, `formations[${i}]: zoom (0.6–2.5) belongs to form camera, which needs it`);
    check(f.form === 'merge' ? objects.has(f.into) && f.ids?.length >= 1 && !f.ids.includes(f.into) : f.into == null, `formations[${i}]: merge folds ids into one other object (into), and only merge takes into`);
    check(f.form === 'split' ? objects.has(f.from) && f.ids?.length >= 1 && !f.ids.includes(f.from) : f.from == null, `formations[${i}]: split brings ids out of one other object (from), and only split takes from`);
    if (f.form === 'fill' || f.form === 'emerge') {
      check(f.ids?.length === 1, `formations[${i}] (${f.form}) names one object in ids`);
      check(FILL_TONES[objects.get(f.ids[0])?.color ?? 'accent'] != null, `formations[${i}] (${f.form}): ${f.ids[0]} must be accent, accent2, surface or ink, the colours a scene can take as its tone`);
      check(f.form === 'fill' ? i === input.formations.length - 1 : i === 0, `formations[${i}]: ${f.form === 'fill' ? 'fill is the last move of its beat (the next scene starts in its colour)' : 'emerge is the first move of its beat (it comes out of the scene before)'}`);
    }
    return f;
  });
  return { objects, formations, seed: input.seed ?? 0, look: input.look ?? knownLook ?? 'tiles' };
}

// Keyframes a move adds to an object it touches (a swap's cause works at it; a hub pulses per arrival).
const KEYS_PER_MOVE = g => ({ wave: 2, swap: 6, merge: 2 * Math.max(1, (g.ids ?? []).length), split: 3, fill: 1, emerge: 1 })[g.form] ?? 1;

/** Where each object stands in one formation: {x, y, scale, rotate, opacity}. */
export function formationTargets(f, ids, frame, { size, seed = 0, current = new Map(), extent = () => [size / 2, size / 2] }) {
  // A heading takes a band of the frame (`frame.top` or `frame.bottom`); the cast keeps to the rest.
  const { width: W, height: H } = frame, tall = H > W, u = Math.min(W, H), top = frame.top ?? 0, bottom = frame.bottom ?? H, A = bottom - top;
  // `beside` sets the formation next to an object where it now stands, on the side facing the middle
  // of the frame (up and to the right of an object in the middle), so it never runs off an edge.
  const near = f.beside != null ? current.get(f.beside) : null;
  const sx = near && near.x > W / 2 + 1 ? -1 : 1, sy = near && near.y < H / 2 - 1 ? 1 : -1;
  // `on` centres the formation on an object where it stands (a small ring around it, a pile on it).
  const host = f.on != null ? current.get(f.on) : null;
  const [cx, cy] = f.center ?? (host ? [host.x, host.y] : near ? [near.x + sx * size * (near.scale ?? 1) * 0.95, near.y + sy * size * (near.scale ?? 1) * 0.75] : [W / 2, top + A / 2]);
  // `spread` is in frame pixels; a small number (4 or less) reads as a multiple of the default.
  const wide = f.spread == null ? null : f.spread <= 4 ? f.spread * u * 0.34 : f.spread;
  const spread = wide ?? u * 0.34, scale = f.scale ?? 1, n = ids.length, out = new Map();
  const place = (id, x, y, extra = {}) => out.set(id, { x, y, scale, rotate: 0, opacity: 1, ...extra });
  const form = f.form === 'line' ? (tall ? 'column' : 'row') : f.form;
  if (form === 'scatter') {
    // A sunflower spiral spread over the frame, jittered by the id: even coverage, never a grid.
    const rx = (tall ? W * 0.36 : W * 0.38) * (wide ? wide / (u * 0.34) : 1), ry = (tall ? A * 0.34 : A * 0.33) * (wide ? wide / (u * 0.34) : 1);
    const pts = ids.map((id, i) => {
      const r = Math.sqrt((i + 0.5) / n), a = i * 2.39996 + seed + hash(`${id}${seed}`) * 0.6;
      return [Math.cos(a) * r * rx, Math.sin(a) * r * ry];
    });
    // A few points of a spiral lean to one side; centre them so the pile sits in the frame's middle.
    const [mx, my] = [0, 1].map(k => pts.reduce((s, p) => s + p[k], 0) / n);
    // Wide objects (word pills) would land on each other: push overlapping pairs apart along their
    // shallower overlap until none touch. Deterministic, a few dozen passes at most.
    const box = ids.map(id => extent(id).map(v => v * scale + size * 0.08));
    for (let pass = 0; pass < 40; pass++) {
      let moved = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
        const ox = box[i][0] + box[j][0] - Math.abs(dx), oy = box[i][1] + box[j][1] - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        if (ox / (box[i][0] + box[j][0]) < oy / (box[i][1] + box[j][1])) { const d = (dx >= 0 ? 1 : -1) * ox / 2; pts[i][0] -= d; pts[j][0] += d; }
        else { const d = (dy >= 0 ? 1 : -1) * oy / 2; pts[i][1] -= d; pts[j][1] += d; }
      }
      if (!moved) break;
    }
    ids.forEach((id, i) => place(id, cx + pts[i][0] - mx, cy + pts[i][1] - my, { rotate: (hash(`${id}r${seed}`) - 0.5) * 28, scale: scale * (0.85 + hash(`${id}s`) * 0.25) }));
  } else if (form === 'row' || form === 'column') {
    const along = form === 'row' ? Math.min(W * 0.84, size * 2 * n) : Math.min(A * 0.66, size * 1.9 * n);
    ids.forEach((id, i) => {
      const d = n === 1 ? 0 : -along / 2 + along * (i / (n - 1)) * (n - 1) / n + along / (2 * n);
      place(id, form === 'row' ? cx + d : cx, form === 'row' ? cy : cy + d);
    });
  } else if (form === 'ring') {
    // An ellipse with the frame's proportions, kept clear of its edges.
    const rx = Math.min(spread * (tall ? 0.8 : 1.25), W / 2 - size * 0.9), ry = Math.min(spread * (tall ? 1.25 : 0.8), A / 2 - size * 0.9);
    ids.forEach((id, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; place(id, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); });
  } else if (form === 'cluster') {
    // Hexagonal packing outward from the centre: a pile of objects touching.
    const gap = size * 1.08 * scale, cells = [[0, 0]];
    for (let ring = 1; cells.length < n; ring++)
      for (let k = 0; k < 6 * ring && cells.length < n; k++) {
        const side = Math.floor(k / ring), step = k % ring, a0 = (side * Math.PI) / 3, a1 = ((side + 1) * Math.PI) / 3;
        const [x0, y0, x1, y1] = [Math.cos(a0) * ring, Math.sin(a0) * ring, Math.cos(a1) * ring, Math.sin(a1) * ring];
        cells.push([x0 + (x1 - x0) * (step / ring), y0 + (y1 - y0) * (step / ring)]);
      }
    ids.forEach((id, i) => place(id, cx + cells[i][0] * gap * sx, cy + cells[i][1] * gap * -sy, { rotate: (hash(`${id}c`) - 0.5) * 12 }));
  } else if (form === 'hero') {
    // One object steps forward; the rest recede into a wide ring, small and quiet. The hero stands
    // centred (its word goes below), so it still holds the frame after the word has gone.
    const others = ids.filter(id => id !== f.hero), heroAt = [cx, cy - (f.word ? u * 0.08 : 0)];
    place(f.hero, heroAt[0], heroAt[1], { scale: (f.scale ?? 2.3) });
    others.forEach((id, i) => {
      const a = -Math.PI / 2 + ((i + 0.5) / others.length) * Math.PI * 2;
      out.set(id, { x: cx + Math.cos(a) * (tall ? W * 0.4 : W * 0.42), y: cy + Math.sin(a) * (tall ? A * 0.36 : A * 0.4), scale: 0.6, rotate: 0, opacity: 0.35 });
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
  // Every placed object stays whole inside the title-safe area (an exit leaves on purpose): a
  // formation set beside an object near an edge, or a wide ring, is pulled back in.
  if (form !== 'exit') {
    const [mx, my] = tall ? [W * 0.1, H * 0.06] : [W * 0.05, H * 0.05];
    for (const [id, t] of out) {
      const [hw, hh] = extent(id).map(v => v * (t.scale ?? 1) * 1.16);
      t.x = Math.min(Math.max(t.x, mx + hw), W - mx - hw);
      t.y = Math.min(Math.max(t.y, Math.max(my, top) + hh), Math.min(H - my, bottom) - hh);
    }
  }
  return out;
}

/**
 * How each look draws an object's tile, its mark and its type. `tiles` are flat rounded tiles with a
 * soft shadow; `drawn` is pen on paper (an ink outline drawn by hand, the colour hatched in, the
 * icon in ink, type in a hand); `print` is a two-colour press (the colour laid in a dot screen,
 * slightly off register, with worn ink).
 */
const LOOK = {
  tiles: { tile: () => ({}), mark: o => (o.color === 'surface' ? 'ink' : 'bg'), font: 'strong', label: 'semibold', shadow: true },
  drawn: { tile: s => ({ stroke: 'ink', width: Math.max(3, s * 0.028), rough: { amount: 1.4, passes: 2, fill: 'hachure', gap: Math.max(5, s * 0.055), angle: -38, hatchWidth: Math.max(3, s * 0.03) } }),
    mark: () => 'ink', font: 'hand', label: 'hand', shadow: false },
  print: { tile: s => ({ print: { screen: 'dots', cell: Math.max(5, Math.round(s * 0.055)), angle: 45, register: [Math.round(s * 0.025), -Math.round(s * 0.015)], wear: 0.25 } }),
    mark: o => (o.color === 'surface' ? 'ink' : 'bg'), font: 'poster', label: 'semibold', shadow: false },
};

/**
 * Composed objects: a small drawn thing instead of an icon on a tile. Each is a body in the object's
 * colour (it takes the look: shadow, hand-drawn hatching or print) and a few details in the colour
 * that reads on it. Geometry is in object units (s is the object's size), centred on its position.
 */
const SHAPES = {
  // A page with a folded corner and lines of text.
  doc: { extent: [0.36, 0.5], draw: (s, d) => ({ body: { x: -0.36 * s, y: -0.5 * s, w: 0.72 * s, h: s, r: 0.05 * s },
    details: [{ type: 'poly', points: [[0.16 * s, -0.5 * s], [0.36 * s, -0.3 * s], [0.16 * s, -0.3 * s]], closed: true, fill: d, opacity: 0.85 },
      ...[-0.16, -0.02, 0.12, 0.26].map((y, i) => ({ type: 'line', x1: -0.22 * s, y1: y * s, x2: (i === 3 ? 0.06 : 0.2) * s, y2: y * s, stroke: d, width: 0.045 * s, cap: 'round' }))] }) },
  // A speech bubble with three dots.
  bubble: { extent: [0.5, 0.44], draw: (s, d, c) => ({ body: { x: -0.5 * s, y: -0.44 * s, w: s, h: 0.7 * s, r: 0.3 * s },
    details: [{ type: 'poly', points: [[-0.3 * s, 0.2 * s], [-0.06 * s, 0.2 * s], [-0.36 * s, 0.44 * s]], closed: true, fill: c, body: true },
      ...[-0.2, 0, 0.2].map(x => ({ type: 'circle', cx: x * s, cy: -0.09 * s, r: 0.06 * s, fill: d }))] }) },
  // A phone with its screen lit.
  phone: { extent: [0.28, 0.5], draw: (s, d) => ({ body: { x: -0.28 * s, y: -0.5 * s, w: 0.56 * s, h: s, r: 0.09 * s },
    details: [{ type: 'rect', x: -0.22 * s, y: -0.38 * s, w: 0.44 * s, h: 0.7 * s, r: 0.03 * s, fill: d, opacity: 0.9 },
      { type: 'line', x1: -0.07 * s, y1: 0.42 * s, x2: 0.07 * s, y2: 0.42 * s, stroke: d, width: 0.035 * s, cap: 'round' }] }) },
  // A card holding a small bar chart.
  card: { extent: [0.5, 0.38], draw: (s, d) => ({ body: { x: -0.5 * s, y: -0.38 * s, w: s, h: 0.76 * s, r: 0.07 * s },
    details: [...[0.18, 0.34, 0.25, 0.44].map((h, i) => ({ type: 'rect', x: (-0.32 + i * 0.17) * s, y: (0.24 - h) * s, w: 0.11 * s, h: h * s, r: 0.015 * s, fill: d })),
      { type: 'line', x1: -0.38 * s, y1: 0.26 * s, x2: 0.38 * s, y2: 0.26 * s, stroke: d, width: 0.03 * s, cap: 'round' }] }) },
  // A person: head and shoulders.
  person: { extent: [0.4, 0.5], draw: (s, d, c) => ({ body: { x: -0.4 * s, y: 0.04 * s, w: 0.8 * s, h: 0.46 * s, r: 0.23 * s },
    details: [{ type: 'circle', cx: 0, cy: -0.24 * s, r: 0.21 * s, fill: c, body: true }] }) },
  // A ticket stub: a perforation and two notches.
  ticket: { extent: [0.5, 0.28], draw: (s, d) => ({ body: { x: -0.5 * s, y: -0.28 * s, w: s, h: 0.56 * s, r: 0.05 * s },
    details: [{ type: 'line', x1: 0.22 * s, y1: -0.2 * s, x2: 0.22 * s, y2: 0.2 * s, stroke: d, width: 0.03 * s, dash: [0.05 * s, 0.05 * s] },
      ...[-1, 1].map(k => ({ type: 'circle', cx: 0.22 * s, cy: k * 0.28 * s, r: 0.07 * s, fill: 'bg' })),
      ...[-0.08, 0.08].map((y, i) => ({ type: 'line', x1: -0.36 * s, y1: y * s, x2: (i ? -0.04 : 0.06) * s, y2: y * s, stroke: d, width: 0.04 * s, cap: 'round' }))] }) },
  // A parcel with its lid and tape.
  box: { extent: [0.41, 0.4], draw: (s, d) => ({ body: { x: -0.41 * s, y: -0.35 * s, w: 0.82 * s, h: 0.75 * s, r: 0.04 * s },
    details: [{ type: 'line', x1: -0.41 * s, y1: -0.14 * s, x2: 0.41 * s, y2: -0.14 * s, stroke: d, width: 0.035 * s },
      { type: 'rect', x: -0.06 * s, y: -0.35 * s, w: 0.12 * s, h: 0.75 * s, fill: d, opacity: 0.55 }] }) },
};

/** Half the width and height an object takes: a tile is square; a word pill is as long as its word. */
export function objectExtent(o, size) {
  const s = o.size ?? size;
  if (o.shape) return SHAPES[o.shape].extent.map(v => v * s);
  return o.word ? [Math.max(s * 0.6, o.word.length * s * 0.3 * 0.29 + s * 0.25), s * 0.3] : [s / 2, s / 2];
}

/**
 * The object as drawn: a group centred on its position (a tile with an icon, or a word on a pill).
 * One that has filled the frame is drawn as its flat colour, its face hidden, until it emerges.
 */
function objectElement(o, id, size, base, enter, look = 'tiles') {
  const s = o.size ?? size, children = [], L = LOOK[look];
  // Hidden and shown by keys from frame one (a base opacity would multiply every later key).
  const face = el => (base.filled ? { ...el, keys: [{ at: 0, opacity: 0, dur: 0 }] } : el);
  // An object that is the frame shows only its flat colour: its drawn body and parts are hidden
  // too (their outline and hatching would show past the colour's edge as it emerges).
  const under = el => (base.filled ? { ...el, keys: [{ at: 0, opacity: 0, dur: 0 }] } : el);
  if (o.word) {
    const [hw, hh] = objectExtent(o, size), fs = s * (look === 'drawn' ? 0.36 : 0.3);
    children.push(under({ type: 'rect', id: `${id}-tile`, x: -hw, y: -hh, w: hw * 2, h: hh * 2, r: hh, fill: o.color, enter: 'none', ...L.tile(s) }),
      face({ type: 'text', id: `${id}-word`, text: o.word, x: 0, y: fs * 0.36, size: fs, font: L.font, fill: look === 'drawn' || o.color !== 'ink' ? 'ink' : 'bg', anchor: 'middle', fit: hw * 2 - s * 0.3, enter: 'none' }));
  } else if (o.shape) {
    // The body takes the look; parts of the body (a bubble's tail, a person's head) do too, and the
    // details are drawn in the colour that reads on it (by hand in the drawn look).
    const { body, details } = SHAPES[o.shape].draw(s, L.mark(o), o.color);
    children.push(under({ type: 'rect', id: `${id}-tile`, ...body, fill: o.color, enter: 'none', ...L.tile(s) }));
    details.forEach(({ body: part, ...el }, k) => children.push(part
      ? under({ ...el, id: `${id}-part${k}`, enter: 'none', ...L.tile(s) })
      : face({ ...el, id: `${id}-detail${k}`, enter: 'none', ...(look === 'drawn' && el.type !== 'circle' ? { rough: { amount: 0.8, passes: 1 } } : {}) })));
  } else {
    children.push(under({ type: 'rect', id: `${id}-tile`, x: -s / 2, y: -s / 2, w: s, h: s, r: s * 0.26, fill: o.color, enter: 'none', ...L.tile(s) }),
      face({ type: 'icon', id: `${id}-icon`, name: o.icon, x: 0, y: 0, size: s * 0.52, stroke: L.mark(o), enter: 'none' }));
  }
  // The flat colour an object floods the frame with (fill/emerge) is its body exactly, so the
  // flood shrinks back as the object's own shape and the drawn body, its parts and its face
  // fade in over it where it lands (fill/emerge hide them while it is the frame).
  const { x, y, w, h, r } = children[0];
  children.splice(1, 0, { type: 'rect', id: `${id}-solid`, x, y, w, h, r, fill: o.color, enter: 'none', keys: [{ at: 0, opacity: base.filled ? 1 : 0, dur: 0 }] });
  if (o.label) children.push({ type: 'text', id: `${id}-label`, text: o.label, x: 0, y: s * 0.5 + s * 0.34, size: Math.max(22, s * (look === 'drawn' ? 0.24 : 0.2)), font: L.label, fill: look === 'drawn' ? 'ink' : 'muted', anchor: 'middle', enter: 'none' });
  // The starting pose is a key at 0, so every later key is absolute (opacity and rotation never compound).
  return { type: 'group', id, x: base.x, y: base.y, shadow: L.shadow, children, ...enter,
    keys: [{ at: 0, scale: base.scale ?? 1, rotate: base.rotate ?? 0, opacity: base.opacity ?? 1, dur: 0 }],
    ...(o.float ? { loop: { type: 'float', period: 3.4 + hash(id) * 1.6, amount: 0.35 } } : {}) };
}

/**
 * Elements for one beat's cast, and the state it ends in. `state`: Map id → pose carried from the
 * previous beat; `cue(v)` resolves a word or seconds to beat time.
 */
export function castElements(spec, frame, { state = new Map(), threads = [], camera = { zoom: 1, x: 0, y: 0 }, unit, cue = v => (typeof v === 'number' ? v : 0) } = {}) {
  // The camera: one stage holding the whole cast, scaled about the frame's middle and panned toward
  // what it looks at. It carries across cuts like the objects do.
  let cam = { ...camera };
  const camKeys = [];
  // Object size is set by the cast's first beat and kept: a cast of four or fewer gets more room each.
  const u = Math.min(frame.width, frame.height), size = unit ?? u * (spec.objects.size <= 4 ? 0.19 : 0.15);
  const pose = new Map(state), groups = new Map(), elements = [], words = [], notes = [], edges = {}, under = [];
  // Draw order carries across cuts too: an object keeps its depth, new ones and anything acting on
  // another come forward.
  let carried = [], top = Math.max(0, ...[...state.values()].map(p => p.z ?? 0));
  // A carried object's group, created on first use where the last beat left it.
  const group = id => {
    if (!groups.has(id)) {
      const g = objectElement(spec.objects.get(id), `cast-${id}`, size, pose.get(id), { at: 0, enter: 'none' }, spec.look);
      groups.set(id, { el: g, base: pose.get(id) });
      elements.push(g);
    }
    return groups.get(id);
  };
  // A hero quiets the rest; when the hero leaves (exit, merge, swapped out) they regather, loosely,
  // rather than staying faint at the edges of an empty frame.
  const release = at => {
    const quiet = [...pose].filter(([, p]) => p.quiet && !p.gone).map(([id]) => id);
    if (!quiet.length || [...pose.values()].some(p => p.hero && !p.gone)) return;
    const back = formationTargets({ form: 'scatter' }, quiet, frame, { size, seed: spec.seed + 97, current: pose, extent: id => objectExtent(spec.objects.get(id), size) });
    for (const id of quiet) {
      const { el, base } = group(id), to = back.get(id);
      el.keys.push({ at, x: to.x - base.x, y: to.y - base.y, scale: to.scale, rotate: to.rotate, opacity: 1, dur: 1.1, ease: 'inOut' });
      pose.set(id, { ...to, z: pose.get(id).z });
    }
  };
  // Formation times: a spoken cue, explicit seconds, or (uncued) evenly after the previous one.
  const times = [];
  spec.formations.forEach((f, k) => times.push(f.say != null ? cue(f.say) : f.at ?? (k === 0 ? 0 : times[k - 1] + 1.6)));
  // A thread or word lasts until the next formation that moves the cast (a wave or a mark leaves it standing).
  const until = k => times.find((_, j) => j > k && !['wave', 'mark', 'camera'].includes(spec.formations[j].form));
  // An object that has exited stays gone unless a formation names it again.
  const alive = id => !pose.get(id)?.gone;
  spec.formations.forEach((f, k) => {
    const t = times[k], stagger = f.stagger ?? 0.06, dur = f.dur ?? 1.1;
    const ids = f.form === 'swap' ? [f.out, f.in] : f.ids ?? [...spec.objects.keys()].filter(id => alive(id) && (f.form !== 'exit' || pose.has(id)));
    // A journey: objects follow a curved route (through `via` waypoints, say a road or a pipe drawn as
    // scenery) to another object or a point, and a hand-drawn trail draws itself behind them. A
    // convoy shares the route. The route sketches itself a little ahead of the traveller, and stays
    // until the cast next moves.
    if (f.form === 'travel') {
      const st = f.stagger ?? 0.3, ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      // A journey needs somewhere to go: an object on screen, or a point.
      check(f.center != null || (pose.has(f.to) && !pose.get(f.to).gone),
        `${f.to} is not on screen when ${ids.join(', ')} travel${ids.length > 1 ? '' : 's'} to it; place it first (for example a cluster at a center) or travel to a center point`);
      // An object not yet on screen travels in from just past the frame edge its `enter` names
      // (left by default), level with where it is going, rather than the move being lost.
      for (const id of ids) {
        if (pose.has(id) && !pose.get(id).gone) continue;
        const o = spec.objects.get(id), dest = f.center ? { x: f.center[0], y: f.center[1] } : pose.get(f.to) ?? { x: frame.width / 2, y: frame.height / 2 };
        const [hw, hh] = objectExtent(o, size), side = ['right', 'drop', 'rise'].includes(o.enter) ? o.enter : 'left';
        const start = { left: { x: -hw * 1.3, y: dest.y }, right: { x: frame.width + hw * 1.3, y: dest.y }, drop: { x: dest.x, y: -hh * 1.3 }, rise: { x: dest.x, y: frame.height + hh * 1.3 } }[side];
        if (groups.has(id)) {
          // It left earlier in this beat: keep that exit, then step back to the entry unseen.
          const { el, base } = groups.get(id);
          el.keys.push({ at: t, x: start.x - base.x, y: start.y - base.y, scale: 1, rotate: 0, opacity: 1, dur: 0 });
        } else {
          const g = objectElement(o, `cast-${id}`, size, { ...start, scale: 1, rotate: 0, opacity: 1 }, { at: 0, enter: 'none' }, spec.look);
          groups.set(id, { el: g, base: start }); elements.push(g);
        }
        pose.set(id, { ...start, scale: 1, rotate: 0, opacity: 1, z: ++top });
      }
      ids.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const p = pose.get(id), { el, base } = group(id);
        let end = f.center ? { x: f.center[0], y: f.center[1] } : pose.get(f.to);
        if (!f.center) {
          // Arrive beside the destination, not on it.
          const reach = (oid, sc) => Math.max(...objectExtent(spec.objects.get(oid), size)) * (sc ?? 1);
          const dx = p.x - end.x, dy = p.y - end.y, d = Math.hypot(dx, dy) || 1, gap = reach(f.to, end.scale) + reach(id, p.scale) * (1 + i * 2) + size * 0.2;
          end = { x: end.x + (dx / d) * gap, y: end.y + (dy / d) * gap };
        }
        // Whole inside the title-safe area, clear of a heading, like every placed object.
        const W = frame.width, H = frame.height, [mx, my] = H > W ? [W * 0.1, H * 0.06] : [W * 0.05, H * 0.05];
        const [hw, hh] = objectExtent(spec.objects.get(id), size).map(v => v * (p.scale ?? 1) * 1.16);
        end = { x: Math.min(Math.max(end.x, mx + hw), W - mx - hw), y: Math.min(Math.max(end.y, Math.max(my, frame.top ?? 0) + hh), Math.min(H - my, frame.bottom ?? H) - hh) };
        // Waypoints, or one gentle bend; a Catmull-Rom curve through them, sampled for the keys.
        const mid = { x: (p.x + end.x) / 2, y: (p.y + end.y) / 2 }, len = Math.hypot(end.x - p.x, end.y - p.y) || 1, bend = len * 0.22 * (hash(`${id}${k}`) > 0.5 ? 1 : -1);
        const pts = [p, ...(f.via ?? [[mid.x - ((end.y - p.y) / len) * bend, mid.y + ((end.x - p.x) / len) * bend]]).map(([x, y]) => ({ x, y })), end];
        const at = (u) => {
          const seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))), l = u * (pts.length - 1) - seg;
          const [a, b, c, d] = [pts[Math.max(0, seg - 1)], pts[seg], pts[seg + 1], pts[Math.min(pts.length - 1, seg + 2)]];
          const cr = (k0, k1, k2, k3) => 0.5 * (2 * k1 + (-k0 + k2) * l + (2 * k0 - 5 * k1 + 4 * k2 - k3) * l * l + (-k0 + 3 * k1 - 3 * k2 + k3) * l * l * l);
          return { x: cr(a.x, b.x, c.x, d.x), y: cr(a.y, b.y, c.y, d.y) };
        };
        // The element's keyframe budget (24) is shared by every route it takes in this beat, after
        // setting aside what its later moves will need: this route gets its share of the rest. Too
        // much for one beat is an authoring error, never a silently dropped move or an invalid scene.
        const touches = g => g.form === 'swap' ? [g.out, g.in, ...(g.by ?? [])].includes(id) : g.form === 'merge' ? g.into === id || (g.ids ?? []).includes(id)
          : g.form === 'split' ? g.from === id || (g.ids ?? []).includes(id) : !['mark', 'camera'].includes(g.form) && (!g.ids || g.ids.includes(id));
        const later = spec.formations.filter((g, j) => j > k && touches(g));
        const routes = 1 + later.filter(g => g.form === 'travel').length;
        const reserve = later.filter(g => g.form !== 'travel').reduce((sum, g) => sum + KEYS_PER_MOVE(g), 0);
        const n = Math.min(16, Math.floor((23 - el.keys.length - reserve) / routes)), t0 = t + i * st;
        check(n >= 4, `${id} has more moves in this beat than one object can carry (24 keyframes: ${routes} journey${routes > 1 ? 's' : ''} and ${later.length - routes + 1} other move${later.length - routes + 1 === 1 ? '' : 's'} after ${el.keys.length} keys); move some of it to the next beat`);
        for (let j = 1; j <= n; j++) {
          const q = at(ease(j / n));
          el.keys.push({ at: t0 + (dur * (j - 1)) / n, x: q.x - base.x, y: q.y - base.y, dur: dur / n, ease: 'linear' });
        }
        pose.set(id, { ...p, x: end.x, y: end.y });
        if (f.trail !== false && i === 0) {
          const d = Array.from({ length: n + 1 }, (_, j) => { const q = at(j / n); return `${j ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join(' ');
          under.push({ type: 'path', id: `cast-trail-${k}-${id}`, d, fill: 'none', stroke: 'muted', width: Math.max(4, size * 0.035), cap: 'round', join: 'round', dash: [size * 0.12, size * 0.1],
            ...(spec.look === 'drawn' ? { rough: { amount: 1, passes: 1 } } : {}), at: t0, enter: 'draw', dur: dur * 0.75, drawEase: 'linear',
            ...(until(k) != null ? { exitAt: until(k), exit: 'fade' } : frame.duration > t0 + dur + 1.2 ? { exitAt: frame.duration - 0.4, exit: 'fade' } : {}) });
        }
      });
      return;
    }
    // Causal shapes: copies fold into one (each flies in and is absorbed; the one they join gives a
    // pulse as each lands), and one breaks out into several (they burst from it into a ring around
    // it, new objects or ones it absorbed earlier).
    if (f.form === 'merge' || f.form === 'split') {
      const hub = f.form === 'merge' ? f.into : f.from, h = pose.get(hub);
      if (!h || !alive(hub)) { notes.push(`${f.form}: ${hub} is not on screen, so nothing moves`); return; }
      const st = f.stagger ?? 0.18, hs = h.scale ?? 1, pulse = [];
      const out = f.form === 'split' ? formationTargets({ form: 'ring', on: hub, spread: f.spread == null ? size * hs * 1.8 : f.spread <= 4 ? f.spread * size * hs * 1.8 : f.spread }, ids, frame, { size, current: pose, extent: id => objectExtent(spec.objects.get(id), size) }) : null;
      ids.forEach((id, i) => {
        const at = t + i * st;
        if (f.form === 'merge') {
          const p = pose.get(id);
          if (!p || p.gone) return;
          const { el, base } = group(id);
          el.keys.push({ at, x: h.x - base.x, y: h.y - base.y, scale: (p.scale ?? 1) * 0.35, rotate: 0, opacity: 0, dur, ease: f.ease ?? 'in' });
          pose.set(id, { x: h.x, y: h.y, scale: (p.scale ?? 1) * 0.35, rotate: 0, opacity: 0, z: p.z, gone: true });
          pulse.push(at + dur * 0.85);
        } else {
          // Out of the hub: an object not yet on screen (or absorbed) starts inside it, small.
          if (!groups.has(id) && (!pose.has(id) || pose.get(id).gone)) {
            const g = objectElement(spec.objects.get(id), `cast-${id}`, size, { x: h.x, y: h.y, scale: 0.3, opacity: 0 }, { at: 0, enter: 'none' }, spec.look);
            groups.set(id, { el: g, base: { x: h.x, y: h.y } }); elements.push(g);
            pose.set(id, { x: h.x, y: h.y, scale: 0.3, opacity: 0, z: (h.z ?? 0) - 0.5 });
          }
          const { el, base } = group(id), to = out.get(id);
          el.keys.push({ at, x: h.x - base.x, y: h.y - base.y, scale: 0.3, opacity: 0, dur: 0 }, { at, x: to.x - base.x, y: to.y - base.y, scale: to.scale, rotate: 0, opacity: 1, dur, ease: f.ease ?? 'out' });
          pose.set(id, { ...to, z: pose.get(id)?.z ?? ++top });
        }
      });
      if (f.form === 'split') pulse.push(t);
      else release(t + dur * 0.5);
      const { el, base } = group(hub), x = h.x - base.x, y = h.y - base.y;
      for (const at of pulse) el.keys.push({ at, x, y, scale: hs * 1.12, dur: 0.12, ease: 'out' }, { at: at + 0.12, x, y, scale: hs, dur: 0.3, ease: 'spring' });
      return;
    }
    // An object can become the frame: it travels to the middle and grows past the edges as its face
    // fades and its colour floods in, and the next scene plays on that colour (the job sets its
    // tone and cuts). `emerge` is the way back: out of the last scene's colour, to where it was.
    if (f.form === 'fill' || f.form === 'emerge') {
      const id = ids[0], p = pose.get(id);
      if (!p || (f.form === 'emerge' && !p.filled)) { notes.push(`${f.form} on ${id}: it ${p ? 'has not filled the frame' : 'is not on screen'}, so nothing moves`); return; }
      const { el, base } = group(id), o = spec.objects.get(id), s = o.size ?? size, solid = el.children.find(c => c.id.endsWith('-solid'));
      const faces = el.children.filter(c => c.type === 'icon' || c.type === 'text' || /-(detail|part)\d+$/.test(c.id));
      // The drawn body under the flat colour is hidden while the object is the frame (its rough
      // outline and hatching would show past the flat shape's edge as it shrinks back). It only
      // ever changes while the opaque flat colour covers it, so the object never turns see-through.
      const tile = el.children.find(c => c.id.endsWith('-tile'));
      if (f.form === 'fill') {
        // Large enough that the flat colour (a rounded rectangle) covers the whole frame through the
        // camera: its inscribed rectangle (half-extent less 0.293 r at each corner) must reach the
        // frame edges, after the camera's zoom and pan move the middle of the stage.
        const a = solid.w / 2 - 0.293 * solid.r, b = solid.h / 2 - 0.293 * solid.r, z = cam.zoom;
        const cover = Math.max((frame.width / 2 + Math.abs(cam.x)) / (z * a), (frame.height / 2 + Math.abs(cam.y)) / (z * b)) * 1.06;
        // The flat colour is the body, which need not sit on the object's origin (a person's
        // shoulders hang below it): place the group so the body's centre, scaled, lands mid-frame.
        const fx = frame.width / 2 - cover * (solid.x + solid.w / 2), fy = frame.height / 2 - cover * (solid.y + solid.h / 2);
        el.keys.push({ at: t, x: fx - base.x, y: fy - base.y, scale: cover, rotate: 0, opacity: 1, dur, ease: f.ease ?? 'in' });
        solid.keys.push({ at: t, opacity: 1, dur: dur * 0.6 });
        for (const c of faces) c.keys = [...(c.keys ?? [{ at: 0, opacity: 1, dur: 0 }]), { at: t, opacity: 0, dur: dur * 0.4 }];
        tile.keys = [...(tile.keys ?? [{ at: 0, opacity: 1, dur: 0 }]), { at: t + dur * 0.6, opacity: 0, dur: dur * 0.15 }];
        pose.set(id, { x: fx, y: fy, scale: cover, rotate: 0, opacity: 1, z: ++top, filled: { ...p, filled: undefined } });
        edges.fill = FILL_TONES[o.color];
      } else {
        const back = p.filled;
        el.keys.push({ at: t, x: back.x - base.x, y: back.y - base.y, scale: back.scale ?? 1, rotate: back.rotate ?? 0, opacity: back.opacity ?? 1, dur, ease: f.ease ?? 'out' });
        tile.keys = [...(tile.keys ?? [{ at: 0, opacity: 0, dur: 0 }]), { at: t + dur * 0.35, opacity: 1, dur: 0 }];
        solid.keys.push({ at: t + dur * 0.35, opacity: 0, dur: dur * 0.5 });
        for (const c of faces) c.keys = [...(c.keys ?? [{ at: 0, opacity: 0, dur: 0 }]), { at: t + dur * 0.45, opacity: 1, dur: dur * 0.4 }];
        pose.set(id, { ...back, z: p.z });
        edges.emerge = FILL_TONES[o.color];
      }
      return;
    }
    // The camera pushes in (zoom above 1) or pulls back, toward `on` where it stands now: most of
    // the way, so the rest of the cast stays in the picture.
    if (f.form === 'camera') {
      const p = f.on != null ? pose.get(f.on) : null, z = f.zoom;
      cam = { zoom: z, x: p ? -z * (p.x - frame.width / 2) * 0.7 : 0, y: p ? -z * (p.y - frame.height / 2) * 0.7 : 0 };
      camKeys.push({ at: t, scale: cam.zoom, x: cam.x, y: cam.y, dur: f.dur ?? 1.8, ease: f.ease ?? 'inOut' });
      return;
    }
    // A wave runs through the objects in order where they stand, each lifting as it passes: a
    // sequence playing, a signal travelling. Nothing moves for good.
    if (f.form === 'wave') {
      ids.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const { el, base } = group(id), p = pose.get(id), at = t + i * (f.stagger ?? 0.16), s = p.scale ?? 1, x = p.x - base.x, y = p.y - base.y;
        el.keys.push({ at, x, y: y - size * 0.22 * (f.scale ?? 1), scale: s * 1.16, dur: 0.2, ease: 'out' }, { at: at + 0.2, x, y, scale: s, dur: 0.34, ease: 'spring' });
      });
      return;
    }
    // A mark is drawn on the cast where it stands, by hand: a loop around what matters, a line under
    // it, a cross through what is set aside, an arrow to where it goes. A mark on one object belongs
    // to it (it moves, scales and leaves with it); it fades when the cast next moves, unless that
    // move takes the object away, and before the cut. An arrow joins two objects and stays put.
    if (f.form === 'mark') {
      const color = f.color ?? (f.mark === 'cross' ? 'negative' : 'accent2');
      const next = spec.formations.findIndex((g, j) => j > k && !['wave', 'mark'].includes(g.form));
      const fade = id => next >= 0 ? (spec.formations[next].form === 'exit' && (spec.formations[next].ids ?? []).includes(id) ? null : times[next])
        : frame.duration > t + 1.6 ? frame.duration - 0.4 : null;
      const pen = { fill: 'none', stroke: color, cap: 'round', join: 'round', rough: { amount: 1, passes: 2 }, enter: 'draw' };
      ids.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const p = pose.get(id), at = t + i * (f.stagger ?? 0.25), seed = hash(`${id}${k}`);
        if (f.mark !== 'arrow') {
          // In the object's own coordinates: its centre is the origin and its scale applies to the pen too.
          const { el } = group(id), r = (spec.objects.get(id).size ?? size) * 0.5, xy = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
          const d = f.mark === 'circle'
            ? Array.from({ length: 29 }, (_, j) => { const a = -2.2 + seed + (j / 28) * Math.PI * 2.15, rr = r * (1.55 + 0.1 * j / 28); return `${j ? 'L' : 'M'}${xy(Math.cos(a) * rr * 1.08, Math.sin(a) * rr * 0.96)}`; }).join(' ')
            : f.mark === 'underline' ? `M${xy(-r * 1.2, r * 1.42)} Q${xy(0, r * 1.62)} ${xy(r * 1.25, r * 1.36)}`
            : `M${xy(-r * 1.1, -r * 1.05)} L${xy(r * 1.1, r * 1.1)} M${xy(r * 1.05, -r * 1.1)} L${xy(-r * 1.1, r * 1.05)}`;
          const out = fade(id);
          el.children.push({ type: 'path', id: `${el.id}-mark-${k}`, d, ...pen, width: Math.max(5, size * 0.045) / (p.scale ?? 1), at, dur: f.mark === 'circle' ? 0.6 : 0.45,
            ...(out != null ? { exitAt: Math.max(at + 0.9, out), exit: 'fade' } : {}) });
          return;
        }
        const r = size * (p.scale ?? 1) * 0.5, pt = (x, y) => `${(p.x + x).toFixed(1)} ${(p.y + y).toFixed(1)}`, out = fade(null), width = Math.max(5, size * 0.045);
        [].concat(f.to).filter(to => pose.has(to) && to !== id).forEach((to, j) => {
          // From the edge of one to just short of the other, bowed a little: a pen stroke, not a connector.
          const q = pose.get(to), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, rq = size * (q.scale ?? 1) * 0.5;
          const [ax, ay, bx, by] = [ux * r * 1.2, uy * r * 1.2, dx - ux * rq * 1.4, dy - uy * rq * 1.4], bend = len * 0.16 * (hash(`${id}${to}`) > 0.5 ? 1 : -1);
          words.push({ type: 'path', id: `cast-mark-${k}-${id}-${to}`, d: `M${pt(ax, ay)} Q${pt((ax + bx) / 2 - uy * bend, (ay + by) / 2 + ux * bend)} ${pt(bx, by)}`,
            ...pen, width, arrow: 'end', head: width * 3.2, at: at + j * 0.2, dur: 0.45, ...(out != null ? { exitAt: Math.max(at + j * 0.2 + 0.9, out), exit: 'fade' } : {}) });
        });
      });
      return;
    }
    // What causes a swap acts first: each `by` object travels onto the one that changes and works
    // at it (a pencil scribbles), and the change lands on the cue.
    if (f.form === 'swap' && f.by?.length && pose.has(f.out)) {
      const c = pose.get(f.out), reach = size * (c.scale ?? 1) * 0.4, from = Math.max(k ? times[k - 1] + 0.2 : 0, t - 1.2);
      f.by.filter(id => pose.has(id) && alive(id)).forEach((id, i) => {
        const p0 = pose.get(id), { el, base } = group(id), x = c.x + reach * (i % 2 ? -1 : 1) - base.x, y = c.y - reach - base.y, s = p0.scale ?? 1;
        // Then, the change made, it goes back to where it stood, upright.
        el.keys.push({ at: from, x, y, scale: s, rotate: -18, dur: Math.max(0.2, Math.min(0.6, t - from - 0.45)), ease: 'inOut' },
          { at: t - 0.42, rotate: -4, y: y + 6, dur: 0.12 }, { at: t - 0.28, rotate: -22, y, dur: 0.12 }, { at: t - 0.14, rotate: -8, y: y + 6, dur: 0.12 },
          { at: t, rotate: -18, y, dur: 0.2 },
          { at: t + Math.max(0.5, dur * 0.9), x: p0.x - base.x, y: p0.y - base.y, scale: s, rotate: p0.rotate ?? 0, dur: 0.7, ease: 'inOut' });
      });
      // The one being changed gives under each stroke.
      const { el, base } = group(f.out), s0 = c.scale ?? 1, [x, y] = [c.x - base.x, c.y - base.y];
      for (const [dt, k] of [[0.42, 0.95], [0.28, 1.02], [0.14, 0.95]]) el.keys.push({ at: t - dt, x, y, scale: s0 * k, dur: 0.12 });
    }
    const targets = formationTargets(f, ids, frame, { size, seed: spec.seed + k, current: pose, extent: id => objectExtent(spec.objects.get(id), size) });
    [...targets.keys()].forEach((id, i) => {
      const to = targets.get(id), at = Math.max(0, t + i * stagger), o = spec.objects.get(id);
      if (!groups.has(id)) {
        const from = pose.get(id);
        // Carried objects stand where the last beat left them; new ones arrive in place, on the cue.
        // `enter: 'none'` stands on frame one: the establishing picture is there before anything moves.
        const g = objectElement(o, `cast-${id}`, size, from ?? to, from || o.enter === 'none' ? { at: 0, enter: 'none' } : { at, enter: o.enter ?? 'pop', dur: o.enter && o.enter !== 'pop' ? 0.8 : 0.5, ...(o.enter && o.enter !== 'pop' && o.enter !== 'fade' ? { dist: size * 4 } : {}) }, spec.look);
        groups.set(id, { el: g, base: from ?? to });
        elements.push(g);
        if (!from) { pose.set(id, { ...to, z: ++top }); return; }
      }
      const { el, base } = groups.get(id);
      el.keys.push({ at, x: to.x - base.x, y: to.y - base.y, scale: to.scale, rotate: to.rotate, opacity: to.opacity, dur, ease: f.ease ?? 'inOut' });
      pose.set(id, { ...to, z: pose.get(id)?.z ?? ++top, gone: f.form === 'exit' || (f.form === 'swap' && id === f.out),
        ...(f.form === 'hero' ? (id === f.hero ? { hero: true } : { quiet: true }) : f.form === 'swap' && id === f.in && pose.get(f.out)?.hero ? { hero: true } : {}) });
    });
    if (f.form === 'exit' || f.form === 'swap') release(t + 0.1);
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
            stroke: 'ink', width: spec.look === 'drawn' ? 4 : 3, cap: 'round', ...(spec.look === 'drawn' ? { rough: { amount: 1.2, passes: 2 } } : {}), at, enter: 'draw', dur: 0.35, ...(until(k) != null ? { exitAt: until(k), exit: 'fade' } : {}) });
        });
        if (until(k) == null) carried = words.filter(w => w.id.startsWith(`cast-thread-${k}-`)).map(({ type, x1, y1, x2, y2, stroke, width, cap, rough }) => ({ type, x1, y1, x2, y2, stroke, width, cap, ...(rough ? { rough } : {}) }));
      }
    }
    if (f.form === 'hero' && f.word) {
      const h = targets.get(f.hero), heroSize = size * (f.scale ?? 2.3);
      words.push({ type: 'text', id: `cast-word-${k}`, text: f.word, x: h.x, y: h.y + heroSize * 0.95, size: u * (spec.look === 'drawn' ? 0.1 : 0.085),
        font: { tiles: 'display', drawn: 'hand', print: 'poster' }[spec.look], fill: 'ink', anchor: 'middle', at: t + dur * 0.6, enter: 'type', fit: frame.width * 0.8,
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
    const g = objectElement(spec.objects.get(id), `cast-${id}`, size, p, { at: 0, enter: 'none' }, spec.look);
    groups.set(id, { el: g, base: p });
    elements.unshift(g);
  }
  for (const { el } of groups.values()) el.keys.sort((a, b) => a.at - b.at);
  // The last word on the budget: a scene the renderer would refuse is refused here, by name.
  for (const [id, { el }] of groups) check(el.keys.length <= 24, `${id} has more moves in this beat than one object can carry (${el.keys.length} of 24 keyframes); move some of them to the next beat`);
  const depth = new Map([...groups].map(([id, { el }]) => [el, pose.get(id)?.z ?? 0]));
  const drawn = [...under, ...[...elements].sort((a, b) => depth.get(a) - depth.get(b)), ...words];
  const moved = camKeys.length || camera.zoom !== 1 || camera.x || camera.y;
  // The stage is there from frame one (its contents keep their own entrances).
  const stage = { type: 'group', id: 'cast-stage', x: 0, y: 0, at: 0, enter: 'none', origin: [frame.width / 2, frame.height / 2], children: drawn,
    keys: [{ at: 0, scale: camera.zoom, x: camera.x, y: camera.y, dur: 0 }, ...camKeys] };
  return { elements: moved ? [stage] : drawn, state: pose, threads: carried, notes, camera: cam, edges, unit: size };
}

export function expandCastProps(input, frame, ctx = {}) {
  if (input?.cast == null) return input;
  const { cast, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'view', 'viewFrom', 'world'])
    check(rest[key] == null, `cannot combine cast with ${key} (a cast lays itself out for the frame)`);
  const spec = castSpec(cast, ctx.objects ?? new Map(), ctx.look ?? null);
  // A heading takes the top of the frame (as on stages); the cast keeps below it.
  if (rest.title || rest.kicker) frame = { ...frame, ...(ctx.heading === 'bottom'
    ? { bottom: frame.height - (frame.height > frame.width ? 430 : frame.height * 0.34) }
    : { top: frame.height > frame.width ? 430 : 300 }) };
  const { elements, state, threads, notes, camera, edges, unit } = castElements(spec, frame, { state: ctx.state, threads: ctx.threads, camera: ctx.camera, unit: ctx.unit, cue: ctx.cue });
  for (const n of notes) ctx.notes?.push(`${frame.beatId ?? 'cast'}: ${n}`);
  if (frame.beatId) {
    const prefix = el => { el.id = `${frame.beatId}-${el.id}`; for (const c of el.children ?? []) prefix(c); };
    elements.forEach(prefix);
  }
  if (ctx.carry) Object.assign(ctx.carry, { state, objects: spec.objects, threads, look: spec.look, camera, unit,
    ...(edges.fill || edges.emerge ? { edges: { ...ctx.carry.edges, [frame.beatId]: edges } } : {}) });
  // Elements the author adds are scenery for the cast (a panel, a label beside it): drawn beneath it.
  return { ...rest, view: [0, 0, frame.width, frame.height], elements: [...(rest.elements ?? []), ...elements] };
}
