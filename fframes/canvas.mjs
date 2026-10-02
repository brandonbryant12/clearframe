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
    geometry: [
      'text',
      'x',
      'y',
      'size',
      'font',
      'anchor',
      'width',
      'height',
      'leading',
      'tracking',
      'upper',
      'count',
      'fit',
    ],
    required: [],
  },
  icon: { geometry: ['name', 'x', 'y', 'size'], required: ['name'] },
  image: { geometry: ['asset', 'file', 'x', 'y', 'w', 'h', 'r', 'fit', 'treatment'], required: ['w', 'h'] },
  group: { geometry: ['children', 'x', 'y', 'stagger'], required: ['children'] },
  meter: { geometry: ['x', 'y', 'w', 'h', 'bars', 'style', 'step', 'gap', 'r'], required: ['w', 'h'] },
  spotlight: { geometry: ['cx', 'cy', 'r', 'x', 'y', 'w', 'h', 'radius', 'dim'], required: [] },
  particles: { geometry: ['x', 'y', 'w', 'h', 'count', 'kind', 'seed', 'size', 'speed'], required: ['w', 'h'] },
  solid: {
    geometry: ['shape', 'cx', 'cy', 'size', 'spin', 'tilt', 'perspective', 'nodes', 'marks', 'arcs', 'shade'],
    required: ['size'],
  },
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
  'subject',
  'depth',
  'z',
  'blur',
  'shine',
  'shadow',
  'glow',
  'mosaic',
  'tilt',
  'material',
  'print',
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
  'assemble',
];
export const EXITS = ['fade', 'shrink', 'fall', 'lift', 'undraw', 'wipe', 'blur', 'none', 'scatter'];
export const LOOPS = ['spin', 'pulse', 'float', 'sway', 'orbit', 'dash', 'blink', 'level', 'rock'];
export const MATERIALS = ['thermal', 'chrome', 'gold', 'neon'];
/** Print finishes: the look of one printing process each (see `printSpec`). */
export const PRINTS = ['benday', 'halftone', 'engraving', 'newsprint', 'letterpress'];
/** Mosaic tile styles: hand-cut tesserae, LCD pixels, or cross-stitches on cloth. */
export const MOSAIC_STYLES = ['tesserae', 'pixel', 'stitch'];
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
export const TREATMENTS = ['none', 'mono', 'duotone', 'tint', 'blur', 'soft', 'halftone', 'engraving'];
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
  'poster',
  'serif-display',
  'serif-display-italic',
  'didone',
  'didone-italic',
  'wide',
  'geometric',
  'geometric-light',
  'condensed',
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
    for (const key of ['shadow', 'glow'])
      if (el[key] != null && typeof el[key] !== 'boolean' && (typeof el[key] !== 'object' || Array.isArray(el[key])))
        fail(`${at}.${key} must be true or {blur, opacity, dx, dy, color}`);
    if (el.depth != null && (!finite(el.depth) || el.depth <= 0 || el.depth > 1))
      fail(`${at}.depth must be above 0 and at most 1 (1 moves with the world; smaller is farther away)`);
    if (el.opacity != null && (!finite(el.opacity) || el.opacity < 0 || el.opacity > 1))
      fail(`${at}.opacity must be 0–1`);
    if (el.z != null && (!finite(el.z) || el.z <= -0.9 || el.z > 50))
      fail(`${at}.z must be above -0.9 and at most 50 (0 is the picture plane; larger is farther away)`);
    if (el.blur != null && (!finite(el.blur) || el.blur < 0 || el.blur > 60)) fail(`${at}.blur must be 0–60 px`);
    if (el.type === 'text' && el.fit != null && (!finite(el.fit) || el.fit <= 0))
      fail(`${at}.fit must be the widest the line may be, in canvas units`);
    if (el.shine != null) el.shine = shineSpec(el.shine, `${at}.shine`, fail);
    if (el.tilt != null && (!Array.isArray(el.tilt) || el.tilt.length !== 2 || el.tilt.some(v => !finite(v))))
      fail(`${at}.tilt must be [x, y] degrees: the plane turned about its horizontal and vertical axes`);
    if (el.material != null) materialSpec(el.material, `${at}.material`, fail);
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
          if (
            ![
              'at',
              'say',
              'dur',
              'ease',
              'x',
              'y',
              'scale',
              'scaleX',
              'scaleY',
              'rotate',
              'opacity',
              'blur',
              'hold',
              'tiltX',
              'tiltY',
            ].includes(key)
          )
            fail(`${at}.keys[${j}]: unsupported field ${key}`);
        if (k.at == null && k.say == null) fail(`${at}.keys[${j}] needs at (seconds) or say (spoken cue)`);
        if (k.blur != null && (!finite(k.blur) || k.blur < 0 || k.blur > 60))
          fail(`${at}.keys[${j}].blur must be 0–60 px`);
        for (const key of ['at', 'dur', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate', 'opacity', 'tiltX', 'tiltY'])
          if (k[key] != null && !finite(k[key])) fail(`${at}.keys[${j}].${key} must be a number`);
        if (k.ease != null && !EASES.includes(k.ease)) fail(`${at}.keys[${j}].ease must be one of ${EASES.join(', ')}`);
        if (k.opacity != null && (k.opacity < 0 || k.opacity > 1)) fail(`${at}.keys[${j}].opacity must be 0–1`);
        if (k.hold != null && typeof k.hold !== 'boolean')
          fail(`${at}.keys[${j}].hold must be false for ambient motion that runs past the cut`);
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
    if (el.mosaic === false) delete el.mosaic;
    else if (el.mosaic != null) {
      if (!MOSAIC_TYPES.has(el.type)) fail(`${at}.mosaic works on rect, circle, ellipse, path, poly and line`);
      el.mosaic = mosaicSpec(el.mosaic, `${at}.mosaic`, fail);
    }
    // `print: false` opts out of a canvas-wide print; `applyPrint` removes the marker.
    if (el.print != null && el.print !== false) {
      if (!PRINT_TYPES.has(el.type)) fail(`${at}.print works on rect, circle, ellipse, path, poly, image and text`);
      el.print = printSpec(el.print, `${at}.print`, fail);
      if (el.type === 'text' && (typeof el.print !== 'object' || el.print.screen || el.print.register))
        fail(`${at}.print on text takes only wear, as {wear} (screens and register need a shape or picture)`);
    }
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
        if (el.kind != null && !['dust', 'embers', 'rain', 'snow', 'bubbles', 'stars', 'warp'].includes(el.kind))
          fail(`${at}.kind must be dust, embers, rain, snow, bubbles, stars or warp`);
        if (el.count != null && (!Number.isInteger(el.count) || el.count < 1 || el.count > 400))
          fail(`${at}.count must be 1–400`);
        break;
      case 'solid':
        if (el.shape != null && !['tetra', 'cube', 'octa', 'icosa', 'dodeca', 'globe'].includes(el.shape))
          fail(`${at}.shape must be tetra, cube, octa, icosa, dodeca or globe`);
        // A globe takes places as [lat, lon] marks and [lat, lon, lat, lon] great-circle arcs.
        const coords = (v, n) =>
          Array.isArray(v) &&
          v.length === n &&
          v.every(Number.isFinite) &&
          v.every((x, i) => Math.abs(x) <= (i % 2 ? 180 : 90));
        if (
          el.marks != null &&
          !(Array.isArray(el.marks) && el.marks.length <= 40 && el.marks.every(m => coords(m, 2)))
        )
          fail(`${at}.marks must be up to 40 [lat, lon] pairs`);
        if (el.arcs != null && !(Array.isArray(el.arcs) && el.arcs.length <= 20 && el.arcs.every(a => coords(a, 4))))
          fail(`${at}.arcs must be up to 20 [lat, lon, lat, lon] routes`);
        if ((el.marks || el.arcs) && el.shape !== 'globe') fail(`${at}: marks and arcs are for shape globe`);
        // Lit faces instead of a wireframe: a key light, ambient fill and edge highlights.
        if (el.shade != null) {
          const s = el.shade;
          const ok =
            s === true ||
            s === false ||
            (s &&
              typeof s === 'object' &&
              !Array.isArray(s) &&
              Object.keys(s).every(k => ['light', 'ambient', 'edges'].includes(k)) &&
              (s.light == null || (Array.isArray(s.light) && s.light.length === 3 && s.light.every(Number.isFinite))) &&
              (s.ambient == null || (Number.isFinite(s.ambient) && s.ambient >= 0 && s.ambient <= 1)) &&
              (s.edges == null || typeof s.edges === 'boolean'));
          if (!ok) fail(`${at}.shade must be true or {light: [x, y, z], ambient: 0–1, edges}`);
          if (el.shape === 'globe') fail(`${at}: shade is for the polyhedra, not the globe`);
        }
        for (const key of ['spin', 'tilt'])
          if (el[key] != null && !(Array.isArray(el[key]) && el[key].length === 3 && el[key].every(Number.isFinite)))
            fail(`${at}.${key} must be [x, y, z] degrees${key === 'spin' ? ' per second' : ''}`);
        if (
          el.perspective != null &&
          !(Number.isFinite(el.perspective) && el.perspective >= 0 && el.perspective <= 0.9)
        )
          fail(`${at}.perspective must be 0–0.9`);
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
const MOSAIC_TYPES = new Set(['rect', 'circle', 'ellipse', 'line', 'path', 'poly']);
/** Validate a mosaic spec: `true` or {tile, gap, jitter, flow, outline, build, shade, shine, grout, axis, seed}. */
export function mosaicSpec(m, at, fail) {
  if (m === true) return {};
  if (!m || typeof m !== 'object' || Array.isArray(m)) fail(`${at} must be true or an object`);
  const ranges = {
    tile: [3, 200],
    gap: [0, 60],
    jitter: [0, 1],
    shade: [0, 0.6],
    shine: [0, 1],
    glint: [0, 1],
    halo: [0, 6],
    spread: [0, 4000],
    axis: [-360, 360],
    seed: [0, 1e9],
  };
  for (const k of Object.keys(m)) {
    if (
      ![
        'tile',
        'gap',
        'jitter',
        'flow',
        'outline',
        'build',
        'from',
        'spread',
        'shade',
        'shine',
        'glint',
        'grout',
        'axis',
        'seed',
        'recolor',
        'halo',
        'knockout',
        'style',
      ].includes(k)
    )
      fail(`${at}: unsupported field ${k}`);
    if (ranges[k] && !(Number.isFinite(m[k]) && m[k] >= ranges[k][0] && m[k] <= ranges[k][1]))
      fail(`${at}.${k} must be ${ranges[k][0]}–${ranges[k][1]}`);
  }
  if (m.flow != null && !['rows', 'rings', 'contour'].includes(m.flow))
    fail(`${at}.flow must be rows, rings or contour`);
  if (m.style != null && !MOSAIC_STYLES.includes(m.style)) fail(`${at}.style must be ${MOSAIC_STYLES.join(', ')}`);
  if (m.build != null && !['sweep', 'radial', 'random', 'fly'].includes(m.build))
    fail(`${at}.build must be sweep, radial, random or fly`);
  if (m.from != null && !(Array.isArray(m.from) && m.from.length === 2 && m.from.every(Number.isFinite)))
    fail(`${at}.from must be [x, y]`);
  if (m.outline != null && typeof m.outline !== 'boolean') fail(`${at}.outline must be true or false`);
  if (m.recolor != null) {
    if (!Array.isArray(m.recolor) || m.recolor.length > 8) fail(`${at}.recolor must be a list of up to 8 fronts`);
    m.recolor.forEach((r, i) => {
      const where = `${at}.recolor[${i}]`;
      if (!r || typeof r !== 'object') fail(`${where} must be {say|at, dur, fill, axis, share}`);
      for (const k of Object.keys(r))
        if (!['say', 'at', 'dur', 'fill', 'axis', 'share'].includes(k)) fail(`${where}: unsupported field ${k}`);
      if (r.say == null && r.at == null) fail(`${where} needs say (a spoken cue) or at (seconds)`);
      if (r.fill == null) fail(`${where} needs a fill (colour, token or gradient)`);
      if (r.share != null && !(Number.isFinite(r.share) && r.share > 0 && r.share <= 1))
        fail(`${where}.share must be 0–1`);
      if (r.dur != null && !(Number.isFinite(r.dur) && r.dur > 0 && r.dur <= 20)) fail(`${where}.dur must be 0–20 s`);
    });
  }
  return { ...m, ...(m.recolor ? { recolor: m.recolor.map(r => ({ ...r })) } : {}) };
}
/**
 * Validate a print finish: a preset name (`benday`, `halftone`, `engraving`, `newsprint`,
 * `letterpress`) or {screen: dots|lines|none, cell, angle, tone, axis, register, wear, ink}.
 * Presets pass through as names; the renderer holds their values.
 */
export function printSpec(p, at, fail) {
  if (typeof p === 'string') {
    if (!PRINTS.includes(p)) fail(`${at} must be one of ${PRINTS.join(', ')} or an object`);
    return p;
  }
  if (!p || typeof p !== 'object' || Array.isArray(p))
    fail(`${at} must be a preset (${PRINTS.join(', ')}) or {screen, cell, angle, tone, axis, register, wear, ink}`);
  for (const k of Object.keys(p))
    if (!['screen', 'cell', 'angle', 'tone', 'axis', 'register', 'wear', 'ink'].includes(k))
      fail(`${at}: unsupported field ${k}`);
  if (p.screen != null && !['dots', 'lines', 'none'].includes(p.screen)) fail(`${at}.screen must be dots, lines or none`);
  if (p.cell != null && !(Number.isFinite(p.cell) && p.cell >= 2 && p.cell <= 160)) fail(`${at}.cell must be 2–160 px`);
  for (const k of ['angle', 'axis'])
    if (p[k] != null && !(Number.isFinite(p[k]) && Math.abs(p[k]) <= 360)) fail(`${at}.${k} must be degrees`);
  const unit = v => Number.isFinite(v) && v >= 0 && v <= 1;
  if (p.tone != null && !(unit(p.tone) || (Array.isArray(p.tone) && p.tone.length === 2 && p.tone.every(unit))))
    fail(`${at}.tone must be 0–1 or [from, to] (ink coverage)`);
  if (
    p.register != null &&
    !(Array.isArray(p.register) && p.register.length === 2 && p.register.every(v => Number.isFinite(v) && Math.abs(v) <= 60))
  )
    fail(`${at}.register must be [dx, dy] up to 60 px`);
  if (p.wear != null && !unit(p.wear)) fail(`${at}.wear must be 0–1`);
  if (p.ink != null && (typeof p.ink !== 'string' || !isColor(p.ink) || p.ink === 'none'))
    fail(`${at}.ink must be a palette token or #rrggbb`);
  return { ...p, ...(Array.isArray(p.tone) ? { tone: [...p.tone] } : {}), ...(p.register ? { register: [...p.register] } : {}) };
}
const PRINT_TYPES = new Set(['rect', 'circle', 'ellipse', 'path', 'poly', 'image', 'text']);
/**
 * A canvas-level print (`spec`, or null for none): every shape without its own finish is
 * printed the same way. Always called, so `print: false` opt-outs are removed either way.
 */
export function applyPrint(list, spec) {
  eachElement(list, el => {
    if (el.print === false) {
      delete el.print;
      return;
    }
    if (!spec || !['rect', 'circle', 'ellipse', 'path', 'poly'].includes(el.type) || el.print !== undefined) return;
    // Frame-sized shapes (a sky, a ground) stay flat, so no register shift opens an edge.
    const e = elementsExtent([el]);
    if (e && e.w * e.h > 1.5e6) return;
    el.print = typeof spec === 'string' ? spec : { ...spec };
  });
}
/** A canvas-level mosaic: every shape without its own setting is laid in tiles. */
export function applyMosaic(list, spec) {
  eachElement(list, el => {
    if (!MOSAIC_TYPES.has(el.type) || el.mosaic !== undefined || el.dash) return;
    // Backdrop-sized shapes (a ground, a sky) stay flat; the mosaic backdrop covers them.
    const e = elementsExtent([el]);
    if (e && e.w * e.h > 4e6) return;
    el.mosaic = { ...spec };
  });
}
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
  (el.type === 'solid' || (['line', 'path', 'poly'].includes(el.type) && (el.fill == null || el.fill === 'none'))
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
export function scheduleElements(list, { start, stagger = 0, entrance, resolve, limit = Infinity, still = false }) {
  let settle = start;
  list.forEach((el, i) => {
    // A group placed with no entrance places its contents with none: children that do not
    // ask for one would otherwise draw or fade in on the cut frame.
    if (still && el.enter == null) el.enter = 'none';
    if (el.say != null) {
      // Type cued to a word is legible as the word is said: its entrance starts a moment early.
      el.at = Math.max(0, resolve(el.say) - (el.type === 'text' ? 0.2 : 0));
      delete el.say;
    }
    el.at ??= start + i * stagger;
    const enter = defaultEnter(el);
    const chars = String(el.text ?? '').length;
    el.dur ??=
      enter === 'draw'
        ? T.draw
        : enter === 'assemble'
          ? T.draw * 1.3
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
    // Mosaic recolour fronts resolve their spoken cues like keys.
    for (const r of el.mosaic?.recolor ?? []) {
      if (r.say != null) {
        r.at = resolve(r.say);
        delete r.say;
      }
      r.dur ??= 1.2;
      settle = Math.max(settle, r.at + r.dur);
    }
    if (el.shine) {
      if (el.shine.say != null) {
        el.shine.at = resolve(el.shine.say);
        delete el.shine.say;
      }
      el.shine.at ??= el.at + el.dur;
    }
    for (const k of el.keys ?? []) {
      if (k.say != null) {
        k.at = resolve(k.say);
        delete k.say;
      }
      k.dur ??= T.key;
      // `hold: false`: ambient motion (traffic, drifting cloud) runs on past the cut.
      if (k.hold !== false) settle = Math.max(settle, k.at + k.dur);
      delete k.hold;
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
        scheduleElements(el.children, {
          start: el.at,
          stagger: el.stagger ?? 0,
          entrance,
          resolve,
          limit,
          still: el.enter === 'none',
        }),
      );
  });
  return settle;
}

/**
 * A light sweep across an element (a title catching the light): `{at|say, dur, color, width,
 * angle, opacity, every}`. `every` repeats the sweep after that many seconds.
 */
/** A material: a preset name, or {map: preset | [2–8 colours], depth, soften, flow, stripe, angle, grain, gain}. */
export function materialSpec(v, where, fail) {
  if (typeof v === 'string') {
    if (!MATERIALS.includes(v)) fail(`${where} must be one of ${MATERIALS.join(', ')} or an object`);
    return v;
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${where} must be a preset name or an object`);
  for (const k of Object.keys(v))
    if (!['map', 'depth', 'soften', 'flow', 'stripe', 'angle', 'grain', 'gain'].includes(k))
      fail(`${where}: unsupported field ${k}`);
  if (v.map != null) {
    const ok =
      (typeof v.map === 'string' && MATERIALS.includes(v.map)) ||
      (Array.isArray(v.map) && v.map.length >= 2 && v.map.length <= 8 && v.map.every(c => isColor(c) && c !== 'none'));
    if (!ok) fail(`${where}.map must be a preset name or 2–8 colours (tokens or #rrggbb), cold rim to hot core`);
  }
  for (const k of ['depth', 'soften', 'flow', 'stripe', 'angle', 'grain', 'gain'])
    if (v[k] != null && !finite(v[k])) fail(`${where}.${k} must be a number`);
  for (const [k, lo, hi] of [
    ['depth', 0.5, 120],
    ['soften', 0, 60],
    ['stripe', 0, 1],
    ['grain', 0, 1],
    ['gain', 0.2, 4],
  ])
    if (v[k] != null && (v[k] < lo || v[k] > hi)) fail(`${where}.${k} must be ${lo}–${hi}`);
  return v;
}

export function shineSpec(v, where, fail) {
  const spec = v === true ? {} : v;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec))
    fail(`${where} must be true or {at|say, dur, color, width, angle, opacity, every}`);
  for (const k of Object.keys(spec))
    if (!['at', 'say', 'dur', 'color', 'width', 'angle', 'opacity', 'every'].includes(k))
      fail(`${where}: unsupported field ${k}`);
  const range = (k, lo, hi) => {
    if (spec[k] != null && (!finite(spec[k]) || spec[k] < lo || spec[k] > hi))
      fail(`${where}.${k} must be ${lo}–${hi}`);
  };
  range('dur', 0.2, 6);
  range('width', 0.05, 1);
  range('angle', -80, 80);
  range('opacity', 0, 1);
  range('every', 1, 60);
  range('at', 0, 1e6);
  if (spec.color != null && (!isColor(spec.color) || spec.color === 'none'))
    fail(`${where}.color must be a palette colour`);
  return structuredClone(spec);
}

/** Camera depth keys for a canvas: `dolly` moves the camera through `z` (a fly-through). */
export function depthKeys(list, where, fail) {
  if (!Array.isArray(list) || !list.length || list.length > 12)
    fail(`${where} must be 1–12 keys {at|say, z, dur, ease}`);
  return list.map((k, i) => {
    if (!k || typeof k !== 'object') fail(`${where}[${i}] must be an object`);
    for (const key of Object.keys(k))
      if (!['at', 'say', 'z', 'dur', 'ease'].includes(key)) fail(`${where}[${i}]: unsupported field ${key}`);
    if (k.at == null && k.say == null) fail(`${where}[${i}] needs at (seconds) or say (spoken cue)`);
    if (!finite(k.z) || k.z <= -0.9 || k.z > 50) fail(`${where}[${i}].z must be above -0.9 and at most 50`);
    if (k.dur != null && (!finite(k.dur) || k.dur < 0 || k.dur > 30)) fail(`${where}[${i}].dur must be 0–30 seconds`);
    if (k.ease != null && !EASES.includes(k.ease)) fail(`${where}[${i}].ease must be one of ${EASES.join(', ')}`);
    return { ...k };
  });
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
    // Chapter numbering ("01 · Software", "2. Tools") is not a figure.
    const text = String(el.text ?? '').replace(/^\s*\d{1,2}\s*[·.)\-–—:]\s*/, '');
    if (el.type === 'text' && /\d/.test(text)) found = true;
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
      else if (el.type === 'solid') {
        const r = el.size ?? 120;
        grow(dx + n('cx') - r, dy + n('cy') - r, dx + n('cx') + r, dy + n('cy') + r);
      } else if (el.type === 'circle' || el.type === 'ellipse') {
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

/**
 * A camera rect re-framed for another aspect ratio (a landscape world in a vertical film):
 * centred on what the beat itself draws, ignoring backdrop-sized elements, or, for a beat
 * that mostly reveals earlier work, on the same centre with the same area.
 */
export function reframeView(view, elements, aspect) {
  const [x, y, w, h] = view;
  if (Math.abs(w / h - aspect) / aspect < 0.15) return view;
  // The subject is the beat's own foreground: backdrops, parallax layers, behind layers and
  // particles do not say where to look. A composition that cannot survive the crop (a map
  // beside its labels) needs its own rect: `viewTall` for vertical cuts.
  const fits = el => {
    const e = elementsExtent([el]);
    return e && e.w <= w && e.h <= h;
  };
  const foreground = elements.filter(
    el => !el.carried && !el.behind && el.depth == null && el.type !== 'particles' && fits(el),
  );
  const own = elementsExtent(foreground);
  // A beat that mostly reveals earlier work (a pull-back) keeps its centre and area.
  const [cx, cy, nw] =
    own && own.w >= w * 0.3
      ? [
          own.left + own.w / 2,
          own.top + own.h / 2,
          Math.min(w, Math.max(own.w * 1.2, own.h * 1.2 * aspect, h * aspect * 0.9)),
        ]
      : [x + w / 2, y + h / 2, Math.sqrt(w * h * aspect)];
  const nh = nw / aspect;
  return [cx - nw / 2, cy - nh / 2, nw, nh];
}
