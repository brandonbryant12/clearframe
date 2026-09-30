// Author-drawn canvas elements: validation with author-facing messages, cue resolution and
// exact scheduling. Used by the `canvas` block and by every beat's `art` layers. The renderer
// (fframes/native/src/canvas.rs) re-validates structure and draws what this module prepares.
import { ICONS } from './icons.mjs';
import { CANVAS_TIMING as T } from './constants.mjs';

export const ELEMENT_TYPES = {
  rect: { geometry: ['x', 'y', 'w', 'h', 'r'], required: ['w', 'h'] },
  circle: { geometry: ['cx', 'cy', 'r'], required: ['r'] },
  ellipse: { geometry: ['cx', 'cy', 'rx', 'ry'], required: ['rx', 'ry'] },
  line: { geometry: ['x1', 'y1', 'x2', 'y2', 'arrow', 'head'], required: ['x2', 'y2'] },
  path: { geometry: ['d', 'arrow', 'head'], required: ['d'] },
  poly: { geometry: ['points', 'closed', 'arrow', 'head'], required: ['points'] },
  text: {
    geometry: ['text', 'x', 'y', 'size', 'font', 'anchor', 'width', 'height', 'leading', 'tracking', 'upper', 'count'],
    required: [],
  },
  icon: { geometry: ['name', 'x', 'y', 'size'], required: ['name'] },
  image: { geometry: ['asset', 'file', 'x', 'y', 'w', 'h', 'r', 'fit', 'treatment'], required: ['w', 'h'] },
  group: { geometry: ['children', 'x', 'y', 'stagger'], required: ['children'] },
  meter: { geometry: ['x', 'y', 'w', 'h', 'bars', 'style', 'step', 'gap', 'r'], required: ['w', 'h'] },
  spotlight: { geometry: ['cx', 'cy', 'r', 'x', 'y', 'w', 'h', 'radius', 'dim'], required: [] },
  particles: { geometry: ['x', 'y', 'w', 'h', 'count', 'kind', 'seed', 'size', 'speed'], required: ['w', 'h'] },
};
const COMMON = [
  'type',
  'id',
  'note',
  'fill',
  'stroke',
  'width',
  'opacity',
  'dash',
  'cap',
  'join',
  'rotate',
  'origin',
  'blend',
  'enter',
  'at',
  'say',
  'dur',
  'dist',
  'exit',
  'exitAt',
  'exitSay',
  'exitDur',
  'keys',
  'loop',
  'along',
  'echo',
  'fps',
  'morphDur',
  'rough',
  'behind',
  'depth',
];
export const ENTERS = [
  'fade',
  'pop',
  'rise',
  'drop',
  'left',
  'right',
  'grow',
  'grow-x',
  'grow-y',
  'draw',
  'wipe',
  'wipe-up',
  'type',
  'scramble',
  'blur',
  'none',
];
export const EXITS = ['fade', 'shrink', 'fall', 'lift', 'undraw', 'wipe', 'blur', 'none'];
export const LOOPS = ['spin', 'pulse', 'float', 'sway', 'orbit', 'dash', 'blink', 'level'];
export const EASES = ['inOut', 'in', 'out', 'linear', 'spring'];
export const COLOR_TOKENS = [
  'bg',
  'surface',
  'ink',
  'muted',
  'accent',
  'accent2',
  'positive',
  'negative',
  'line',
  'wash',
  'wash2',
  'none',
];
export const TREATMENTS = ['none', 'mono', 'duotone', 'tint', 'blur', 'soft'];
export const FONTS = [
  'display',
  'semibold',
  'bold',
  'light',
  'text',
  'regular',
  'strong',
  'figures',
  'serif',
  'serif-italic',
  'italic',
  'mono',
  'hand',
];
export const MAX_ELEMENTS = 600;

const isColor = v => typeof v === 'string' && (COLOR_TOKENS.includes(v) || /^#[\da-f]{6}$/i.test(v));
const finite = v => typeof v === 'number' && Number.isFinite(v);

/** Validate and clone an element list; `fail(message)` throws with the caller's context. */
export function normalizeElements(list, where, fail, state = { count: 0 }, depth = 0) {
  if (!Array.isArray(list)) fail(`${where} must be an array of elements`);
  if (depth > 4) fail(`${where}: groups nest at most four levels`);
  return list.map((input, i) => {
    const at = `${where}[${i}]`;
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`${at} must be an object`);
    const el = structuredClone(input);
    if (++state.count > MAX_ELEMENTS) fail(`a canvas holds at most ${MAX_ELEMENTS} elements`);
    const spec = ELEMENT_TYPES[el.type];
    if (!spec) fail(`${at}.type must be one of ${Object.keys(ELEMENT_TYPES).join(', ')}`);
    for (const key of Object.keys(el))
      if (!COMMON.includes(key) && !spec.geometry.includes(key)) fail(`${at}: unsupported ${el.type} field ${key}`);
    for (const key of spec.required) if (el[key] == null) fail(`${at}: ${el.type} needs ${key}`);
    for (const [key, value] of Object.entries(el)) {
      if (
        [
          'children',
          'keys',
          'loop',
          'along',
          'count',
          'fill',
          'stroke',
          'points',
          'origin',
          'dash',
          'echo',
          'rough',
        ].includes(key)
      )
        continue;
      if (typeof value === 'number' && !Number.isFinite(value)) fail(`${at}.${key} must be finite`);
    }
    for (const key of ['w', 'h', 'r', 'rx', 'ry', 'size', 'width', 'head', 'dur', 'exitDur', 'at', 'exitAt'])
      if (el[key] != null && (!finite(el[key]) || el[key] < 0)) fail(`${at}.${key} must be a nonnegative number`);
    if (el.depth != null && (!finite(el.depth) || el.depth <= 0 || el.depth > 1))
      fail(`${at}.depth must be above 0 and at most 1 (1 moves with the world; smaller is farther away)`);
    if (el.opacity != null && (!finite(el.opacity) || el.opacity < 0 || el.opacity > 1))
      fail(`${at}.opacity must be 0–1`);
    for (const key of ['fill', 'stroke']) {
      const v = el[key];
      if (v == null || isColor(v)) continue;
      if (
        typeof v === 'object' &&
        !Array.isArray(v) &&
        Array.isArray(v.gradient) &&
        v.gradient.length >= 2 &&
        v.gradient.length <= 4 &&
        v.gradient.every(c => isColor(c) && c !== 'none') &&
        Object.keys(v).every(k => ['gradient', 'angle', 'radial', 'fade'].includes(k))
      )
        continue;
      fail(
        `${at}.${key} must be a palette token (${COLOR_TOKENS.join(', ')}), #rrggbb, or {gradient:[2–4 colors], angle, radial, fade}`,
      );
    }
    if (el.enter != null && !ENTERS.includes(el.enter)) fail(`${at}.enter must be one of ${ENTERS.join(', ')}`);
    if (el.exit != null && !EXITS.includes(el.exit)) fail(`${at}.exit must be one of ${EXITS.join(', ')}`);
    if ((el.exitAt != null || el.exitSay != null) && el.exit == null) el.exit = 'fade';
    if (['type', 'scramble'].includes(el.enter) && el.type !== 'text')
      fail(`${at}: enter "${el.enter}" is for text elements`);
    if (el.fps != null && (!finite(el.fps) || el.fps < 2 || el.fps > 60))
      fail(`${at}.fps must be 2–60 (stepped motion, e.g. 12 for "on twos")`);
    if (el.morphDur != null && (!finite(el.morphDur) || el.morphDur < 0.1 || el.morphDur > 4))
      fail(`${at}.morphDur must be 0.1–4 seconds`);
    for (const key of ['say', 'exitSay'])
      if (el[key] != null && (typeof el[key] !== 'string' || !el[key].trim()))
        fail(`${at}.${key} must be a spoken word or phrase`);
    if (
      el.dash != null &&
      (!Array.isArray(el.dash) || el.dash.length < 1 || el.dash.length > 6 || el.dash.some(v => !finite(v) || v < 0))
    )
      fail(`${at}.dash must be 1–6 nonnegative lengths`);
    if (el.origin != null && (!Array.isArray(el.origin) || el.origin.length !== 2 || el.origin.some(v => !finite(v))))
      fail(`${at}.origin must be [x, y]`);
    if (el.cap != null && !['round', 'butt', 'square'].includes(el.cap))
      fail(`${at}.cap must be round, butt or square`);
    if (el.join != null && !['round', 'miter', 'bevel'].includes(el.join))
      fail(`${at}.join must be round, miter or bevel`);
    if (
      el.blend != null &&
      !['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'soft-light', 'difference'].includes(el.blend)
    )
      fail(`${at}.blend is not a supported blend mode`);
    if (el.arrow != null && !['start', 'end', 'both', 'none'].includes(el.arrow))
      fail(`${at}.arrow must be start, end, both or none`);
    if (el.keys != null) {
      if (!Array.isArray(el.keys) || el.keys.length > 24) fail(`${at}.keys must be up to 24 keyframes`);
      el.keys.forEach((k, j) => {
        if (!k || typeof k !== 'object') fail(`${at}.keys[${j}] must be an object`);
        for (const key of Object.keys(k))
          if (!['at', 'say', 'dur', 'ease', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'opacity'].includes(key))
            fail(`${at}.keys[${j}]: unsupported field ${key}`);
        if (k.at == null && k.say == null) fail(`${at}.keys[${j}] needs at (seconds) or say (spoken cue)`);
        for (const key of ['at', 'dur', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'opacity'])
          if (k[key] != null && !finite(k[key])) fail(`${at}.keys[${j}].${key} must be a number`);
        if (k.ease != null && !EASES.includes(k.ease)) fail(`${at}.keys[${j}].ease must be one of ${EASES.join(', ')}`);
        if (k.opacity != null && (k.opacity < 0 || k.opacity > 1)) fail(`${at}.keys[${j}].opacity must be 0–1`);
      });
    }
    if (el.loop != null) {
      const l = el.loop;
      if (!l || typeof l !== 'object' || !LOOPS.includes(l.type))
        fail(`${at}.loop.type must be one of ${LOOPS.join(', ')}`);
      for (const key of Object.keys(l))
        if (!['type', 'period', 'amount'].includes(key)) fail(`${at}.loop: unsupported field ${key}`);
      if (l.period != null && (!finite(l.period) || l.period < 0.1 || l.period > 120))
        fail(`${at}.loop.period must be 0.1–120 seconds`);
      if (l.amount != null && !finite(l.amount)) fail(`${at}.loop.amount must be a number`);
      if (l.type === 'dash' && !el.dash) fail(`${at}: a dash loop needs a dash pattern`);
    }
    if (el.along != null) {
      const r = el.along;
      if (!r || typeof r !== 'object' || typeof r.d !== 'string') fail(`${at}.along needs path data d`);
      for (const key of Object.keys(r))
        if (!['d', 'at', 'say', 'dur', 'ease', 'rotate', 'loop'].includes(key))
          fail(`${at}.along: unsupported field ${key}`);
      pathData(r.d, `${at}.along.d`, fail);
      if (r.ease != null && !EASES.includes(r.ease)) fail(`${at}.along.ease must be one of ${EASES.join(', ')}`);
    }
    if (el.rough === false) delete el.rough;
    else if (el.rough != null) el.rough = roughSpec(el.rough, `${at}.rough`, fail);
    if (el.echo != null) {
      const e = el.echo;
      if (!e || typeof e !== 'object' || Array.isArray(e)) fail(`${at}.echo must be {count, lag, step, fade, to}`);
      for (const key of Object.keys(e))
        if (!['count', 'lag', 'step', 'fade', 'to'].includes(key)) fail(`${at}.echo: unsupported field ${key}`);
      e.count ??= 6;
      if (!Number.isInteger(e.count) || e.count < 1 || e.count > 24) fail(`${at}.echo.count must be 1–24`);
      if (e.lag != null && (!finite(e.lag) || e.lag < 0 || e.lag > 2)) fail(`${at}.echo.lag must be 0–2 seconds`);
      if (e.fade != null && (!finite(e.fade) || e.fade < 0 || e.fade > 1)) fail(`${at}.echo.fade must be 0–1`);
      if (e.to != null && (!isColor(e.to) || e.to === 'none')) fail(`${at}.echo.to must be a palette colour`);
      if (
        e.step != null &&
        (typeof e.step !== 'object' ||
          Object.entries(e.step).some(([k, v]) => !['x', 'y', 'rotate', 'scale'].includes(k) || !finite(v)))
      )
        fail(`${at}.echo.step takes numeric x, y, rotate, scale`);
      if (!e.lag && !e.step) fail(`${at}.echo needs lag (a motion trail) or step (stacked copies)`);
    }
    switch (el.type) {
      case 'path':
        pathData(el.d, `${at}.d`, fail);
        break;
      case 'poly':
        if (
          !Array.isArray(el.points) ||
          el.points.length < 2 ||
          el.points.length > 400 ||
          el.points.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(finite))
        )
          fail(`${at}.points must be 2–400 [x, y] pairs`);
        break;
      case 'text': {
        if (el.count == null && (typeof el.text !== 'string' || !el.text.trim()))
          fail(`${at}: text needs text or count`);
        if (el.text != null && (typeof el.text !== 'string' || el.text.length > 240))
          fail(`${at}.text must be up to 240 characters`);
        if (el.font != null && !FONTS.includes(el.font)) fail(`${at}.font must be one of ${FONTS.join(', ')}`);
        if (el.anchor != null && !['start', 'middle', 'end'].includes(el.anchor))
          fail(`${at}.anchor must be start, middle or end`);
        if (el.count != null) {
          const c = el.count;
          if (!c || typeof c !== 'object' || !finite(c.to)) fail(`${at}.count needs a numeric to`);
          for (const key of Object.keys(c))
            if (!['from', 'to', 'decimals', 'prefix', 'suffix', 'dur'].includes(key))
              fail(`${at}.count: unsupported field ${key}`);
          c.from ??= 0;
          c.decimals ??= 0;
          c.dur ??= T.count;
          if (
            !finite(c.from) ||
            !Number.isInteger(c.decimals) ||
            c.decimals < 0 ||
            c.decimals > 8 ||
            !finite(c.dur) ||
            c.dur <= 0
          )
            fail(`${at}.count needs finite from, decimals 0–8 and a positive dur`);
        }
        break;
      }
      case 'icon':
        if (!ICONS.includes(el.name)) fail(`${at}: unknown icon ${el.name}; run clearframe icons`);
        break;
      case 'meter':
        if (el.style != null && !['bars', 'mirror', 'ring', 'wave'].includes(el.style))
          fail(`${at}.style must be bars, mirror, ring or wave`);
        if (el.bars != null && (!Number.isInteger(el.bars) || el.bars < 3 || el.bars > 96))
          fail(`${at}.bars must be 3–96`);
        break;
      case 'particles':
        if (el.kind != null && !['dust', 'embers', 'rain', 'snow', 'bubbles'].includes(el.kind))
          fail(`${at}.kind must be dust, embers, rain, snow or bubbles`);
        if (el.count != null && (!Number.isInteger(el.count) || el.count < 1 || el.count > 400))
          fail(`${at}.count must be 1–400`);
        break;
      case 'spotlight':
        if (
          !(el.cx != null && el.cy != null && el.r != null) &&
          !(el.x != null && el.y != null && el.w != null && el.h != null)
        )
          fail(`${at}: spotlight needs cx, cy, r (circle) or x, y, w, h (box)`);
        if (el.dim != null && (!finite(el.dim) || el.dim < 0 || el.dim > 1)) fail(`${at}.dim must be 0–1`);
        break;
      case 'image':
        if (!el.asset && !el.file) fail(`${at}: image needs asset or file`);
        if (el.fit != null && !['cover', 'contain'].includes(el.fit)) fail(`${at}.fit must be cover or contain`);
        if (el.treatment != null && !TREATMENTS.includes(el.treatment))
          fail(`${at}.treatment must be one of ${TREATMENTS.join(', ')}`);
        break;
      case 'group':
        if (el.stagger != null && (!finite(el.stagger) || el.stagger < 0 || el.stagger > 3))
          fail(`${at}.stagger must be 0–3 seconds`);
        el.children = normalizeElements(el.children, `${at}.children`, fail, state, depth + 1);
        break;
    }
    return el;
  });
}

/** Hand-drawn stroke settings: `true` or {amount, passes, boil, fill: hachure|solid, gap, angle, hatchWidth}. */
export function roughSpec(value, where, fail) {
  const r = value === true ? {} : value;
  if (!r || typeof r !== 'object' || Array.isArray(r))
    fail(`${where} must be true or {amount, passes, boil, fill, gap, angle, hatchWidth}`);
  for (const [k, v] of Object.entries(r)) {
    if (k === 'fill') {
      if (!['hachure', 'solid'].includes(v)) fail(`${where}.fill must be hachure or solid`);
      continue;
    }
    if (!['amount', 'passes', 'boil', 'gap', 'angle', 'hatchWidth'].includes(k))
      fail(`${where}: unsupported field ${k}`);
    if (!finite(v)) fail(`${where}.${k} must be a number`);
  }
  if (r.amount != null && (r.amount < 0 || r.amount > 40)) fail(`${where}.amount must be 0–40`);
  if (r.passes != null && (!Number.isInteger(r.passes) || r.passes < 1 || r.passes > 3))
    fail(`${where}.passes must be 1–3`);
  if (r.boil != null && (r.boil < 0 || r.boil > 30)) fail(`${where}.boil must be 0–30 re-draws per second`);
  return { ...r };
}
const ROUGH_TYPES = new Set(['rect', 'circle', 'ellipse', 'line', 'path', 'poly']);
/** Apply a canvas-wide hand-drawn default to every drawable element that has not opted out. */
export function applyRough(list, rough) {
  eachElement(list, el => {
    if (ROUGH_TYPES.has(el.type) && el.rough === undefined && !el.dash) el.rough = { ...rough };
  });
}

function pathData(d, where, fail) {
  if (typeof d !== 'string' || !d.trim() || d.length > 12000)
    fail(`${where} must be SVG path data up to 12,000 characters`);
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(d) || !/^\s*[Mm]/.test(d))
    fail(`${where} must be plain SVG path data starting with M (commands MLHVCSQTAZ and numbers)`);
}

/** Visit every element, depth first. */
export function eachElement(list, visit) {
  for (const el of list ?? []) {
    visit(el);
    if (el.type === 'group') eachElement(el.children, visit);
  }
}

const defaultEnter = el =>
  el.enter ??
  (['line', 'path', 'poly'].includes(el.type) && (el.fill == null || el.fill === 'none')
    ? 'draw'
    : el.type === 'text'
      ? 'rise'
      : ['icon', 'circle'].includes(el.type)
        ? 'pop'
        : 'fade');

/**
 * Resolve spoken cues to scene seconds and write explicit `at`/`dur` into every element,
 * mirroring the renderer's defaults. Returns the scene second by which every entrance,
 * count, keyframe and path move has finished (ambient loops continue by design).
 * `resolve(value)` maps a number (seconds) or spoken phrase to scene seconds.
 */
export function scheduleElements(list, { start, stagger = 0, entrance, resolve, limit = Infinity }) {
  let settle = start;
  list.forEach((el, i) => {
    if (el.say != null) {
      el.at = resolve(el.say);
      delete el.say;
    }
    el.at ??= start + i * stagger;
    const enter = defaultEnter(el);
    const chars = String(el.text ?? '').length;
    el.dur ??=
      enter === 'draw'
        ? T.draw
        : enter === 'type'
          ? Math.min(T.typeMax, Math.max(T.typeMin, chars * T.typePerChar))
          : enter === 'scramble'
            ? T.scramble
            : ['grow', 'grow-x', 'grow-y', 'wipe', 'wipe-up'].includes(enter)
              ? T.grow
              : enter === 'none'
                ? 0
                : entrance;
    settle = Math.max(settle, el.at + el.dur);
    if (el.type === 'text' && el.count) settle = Math.max(settle, el.at + el.count.dur);
    if (el.exitSay != null) {
      el.exitAt = resolve(el.exitSay);
      delete el.exitSay;
    }
    if (el.exitAt != null) {
      el.exitDur ??= entrance;
      if (el.exitAt < el.at)
        throw new Error(`an element exits (${el.exitAt.toFixed(2)}s) before it enters (${el.at.toFixed(2)}s)`);
      // An exit timed after the beat (tidying a world while the camera is away) does not hold it.
      if (el.exitAt < limit) settle = Math.max(settle, el.exitAt + el.exitDur);
    }
    for (const k of el.keys ?? []) {
      if (k.say != null) {
        k.at = resolve(k.say);
        delete k.say;
      }
      k.dur ??= T.key;
      settle = Math.max(settle, k.at + k.dur);
    }
    if (el.keys) el.keys.sort((a, b) => a.at - b.at);
    if (el.along) {
      if (el.along.say != null) {
        el.along.at = resolve(el.along.say);
        delete el.along.say;
      }
      el.along.at ??= el.at;
      el.along.dur ??= T.along;
      settle = Math.max(settle, el.along.at + el.along.dur);
    }
    if (el.type === 'group')
      settle = Math.max(
        settle,
        scheduleElements(el.children, { start: el.at, stagger: el.stagger ?? 0, entrance, resolve, limit }),
      );
  });
  return settle;
}

/** Latest scheduled entrance start (for too-late checks). */
export function latestEntrance(list) {
  let latest = { at: 0, end: 0 };
  eachElement(list, el => {
    if (el.at + el.dur > latest.end) latest = { at: el.at, end: el.at + el.dur };
  });
  return latest;
}

/** True when any element reacts to the narration's loudness. */
export const usesLevels = list => {
  let found = false;
  eachElement(list, el => {
    if (el.type === 'meter' || el.loop?.type === 'level') found = true;
  });
  return found;
};
export const hasCount = list => {
  let found = false;
  eachElement(list, el => {
    if (el.type === 'text' && el.count) found = true;
  });
  return found;
};
export const hasDigits = list => {
  let found = false;
  eachElement(list, el => {
    if (el.type === 'text' && /\d/.test(el.text ?? '')) found = true;
  });
  return found;
};

/** End and control points of SVG path data, absolute (enough for a bounding box). */
function pathPoints(d) {
  const ARITY = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
  const out = [];
  let x = 0,
    y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const n = ARITY[cmd.toLowerCase()],
      rel = cmd === cmd.toLowerCase(),
      v = args.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
    for (let i = 0; n && i + n <= v.length; i += n) {
      const g = v.slice(i, i + n),
        k = cmd.toLowerCase();
      if (k === 'h') x = rel ? x + g[0] : g[0];
      else if (k === 'v') y = rel ? y + g[0] : g[0];
      else {
        const pairs = k === 'a' ? [g.slice(5)] : Array.from({ length: n / 2 }, (_, j) => g.slice(2 * j, 2 * j + 2));
        pairs.forEach(([px, py], j) => {
          const p = rel ? [x + px, y + py] : [px, py];
          out.push(p);
          if (j === pairs.length - 1) [x, y] = p;
        });
        continue;
      }
      out.push([x, y]);
    }
  }
  return out;
}

/** Rough extent of canvas elements at rest, in author units: {w, h, bottom, left, top}. */
export function elementsExtent(elements) {
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity;
  const grow = (x0, y0, x1, y1) => {
    l = Math.min(l, x0);
    t = Math.min(t, y0);
    r = Math.max(r, x1);
    b = Math.max(b, y1);
  };
  const walk = (list, dx = 0, dy = 0) => {
    for (const el of list) {
      const n = k => el[k] ?? 0;
      if (el.type === 'group') walk(el.children ?? [], dx + n('x'), dy + n('y'));
      else if (['rect', 'image', 'meter', 'particles'].includes(el.type))
        grow(dx + n('x'), dy + n('y'), dx + n('x') + n('w'), dy + n('y') + n('h'));
      else if (el.type === 'circle' || el.type === 'ellipse') {
        const rx = el.r ?? el.rx ?? 0,
          ry = el.r ?? el.ry ?? 0;
        grow(dx + n('cx') - rx, dy + n('cy') - ry, dx + n('cx') + rx, dy + n('cy') + ry);
      } else if (el.type === 'line')
        grow(
          dx + Math.min(n('x1'), n('x2')),
          dy + Math.min(n('y1'), n('y2')),
          dx + Math.max(n('x1'), n('x2')),
          dy + Math.max(n('y1'), n('y2')),
        );
      else if (el.type === 'icon') {
        const size = el.size ?? 64;
        grow(dx + n('x') - size / 2, dy + n('y') - size / 2, dx + n('x') + size / 2, dy + n('y') + size / 2);
      } else if (el.type === 'text') {
        // Estimated advance: mono is wide, display faces about half an em per character.
        const size = el.size ?? 48,
          chars = String(
            el.count ? `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}` : (el.text ?? ''),
          ).length;
        const w = el.width ?? chars * size * (el.font === 'mono' ? 0.62 : 0.54);
        const x0 = el.anchor === 'middle' ? n('x') - w / 2 : el.anchor === 'end' ? n('x') - w : n('x');
        grow(dx + x0, dy + n('y') - size * 0.8, dx + x0 + w, dy + n('y') + size * 0.25);
      } else if (el.type === 'path' && typeof el.d === 'string') {
        for (const [x, y] of pathPoints(el.d)) grow(dx + x, dy + y, dx + x, dy + y);
      }
    }
  };
  walk(elements);
  return Number.isFinite(l) ? { w: r - l, h: b - t, left: l, top: t, bottom: b } : null;
}
