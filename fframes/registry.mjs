// Runtime rules for each native block, in one place: how it is cued, which items it stages,
// when its values settle (the exit never starts earlier), which sounds land on its events and
// how critique groups it. Authoring metadata and prop validation live in catalog.mjs; the
// drawing lives in fframes/native/src. A block missing here gets the defaults below.

/** Defaults: cue shortly after the header, settle when the entrance ends. */
const DEFAULTS = { family: 'type', hero: false, numeric: false, cueDelay: 0.35, preroll: 0 };

const hero = { hero: true, cueDelay: 0.1, family: 'type' };
const staged = (key, offset, spacing, itemSeconds = e => e) => ({ staged: { key, offset, spacing, itemSeconds } });
const itemsSettle = key => (p, cue, e, spec) =>
  Math.max(cue + e, ...(p[key] ?? []).map(it => (it.at ?? cue) + spec.staged.itemSeconds(e)));

export const REGISTRY = {
  title: hero,
  statement: hero,
  endcard: hero,
  chapter: { ...hero, sounds: (b, add, t) => add('whoosh', t.start, 0.2, 2) },
  highlight: { ...hero, ...staged('phrases', 0.7, 0.6, () => 0.8) },
  quote: hero,
  callout: hero,
  list: { ...staged('items', 0, 0.45), family: 'type', tock: true },
  checklist: {
    family: 'type',
    ...staged('items', 0.6, 0.55, e => Math.max(e, 0.4)),
    sounds: (b, add, t) => b.props.items.forEach(it => add('tock', t.start + it.at + 0.3, 0.22, 1)),
  },
  stat: {
    family: 'number',
    numeric: true,
    preroll: 1.0,
    settle: (p, cue, e) => cue + Math.max(1.4, 0.6 + e),
    sounds: heroNumber,
  },
  kpis: {
    family: 'number',
    numeric: true,
    ...staged('items', 0, 0.45, e => Math.max(1.3, e)),
    sounds: (b, add, t) => b.props.items.forEach(it => add('tick', t.start + it.at + 1.25, 0.22, 1)),
  },
  delta: {
    family: 'number',
    numeric: true,
    preroll: 1.3,
    settle: (p, cue, e) => cue + Math.max(0.45 + 1.3, 1 + e),
    sounds: heroNumber,
  },
  bars: {
    family: 'chart',
    numeric: true,
    settle: (p, cue) => {
      const grown = cue + (p.data.length - 1) * 0.09 + 1.1;
      return p.focus ? Math.max(grown, p.focus.at + p.focus.dur) : grown;
    },
  },
  line: { family: 'chart', numeric: true, settle: (p, cue, e) => cue + 1.6 + e },
  waffle: {
    family: 'chart',
    numeric: true,
    // Cells arrive, then fill for 1.3 s: the count finishes ~1.9 s after its cue.
    preroll: 1.6,
    settle: (p, cue, e) => cue + Math.max(0.35 + (Math.ceil(p.total / p.cols) + p.cols) * 0.012 + 1.3, 0.7 + e),
  },
  ring: {
    family: 'chart',
    numeric: true,
    preroll: 1.0,
    settle: (p, cue, e) => cue + Math.max(1.4, 0.8 + e),
    sounds: heroNumber,
  },
  donut: { family: 'chart', numeric: true, settle: (p, cue, e) => cue + Math.max(1.5, 1.1 + e) },
  funnel: { family: 'chart', numeric: true, ...staged('items', 0, 0.45, e => Math.max(0.9, 0.3 + e)) },
  magnitude: {
    family: 'chart',
    numeric: true,
    ...staged('items', 0, 0.45, e => Math.max(0.9, 0.3 + e)),
    sounds: heroNumber,
  },
  compare: { family: 'layout' },
  matrix: { family: 'layout' },
  steps: { family: 'diagram', ...staged('items', 0, 0.45), tock: true },
  timeline: { family: 'diagram', ...staged('items', 0, 0.45), tock: true },
  flow: { family: 'diagram', ...staged('nodes', 0, null), tock: true },
  'icon-grid': { family: 'diagram', ...staged('items', 0, null), tock: true },
  cycle: { family: 'diagram' },
  equation: { family: 'diagram' },
  breathing: { family: 'motion' },
  image: { family: 'media' },
  video: { family: 'media' },
  annotate: { family: 'media', ...staged('pins', 0.7, 0.6, e => e + 0.05) },
  kinetic: { family: 'speech' },
  canvas: { family: 'drawing' }, // elements are scheduled by canvas.mjs
};

function heroNumber(b, add, t) {
  add('thud', t.cue + 1.35, 0.32, 3);
}

/** The rules for a block, with defaults filled in. */
export function rules(name) {
  const spec = { ...DEFAULTS, ...(REGISTRY[name] ?? {}) };
  if (spec.staged && !spec.settle) spec.settle = itemsSettle(spec.staged.key);
  if (!spec.settle) spec.settle = (p, cue, e) => cue + e + (spec.hero ? 0.3 : 0);
  return spec;
}
