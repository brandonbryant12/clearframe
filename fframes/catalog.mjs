// The production native vocabulary. Metadata, validation, CLI help and examples share this file.
import { palettes, paletteNotes, PALETTE_KEYS } from './library.mjs';
import { helpers, VALIDATORS } from './validators.mjs';
// Palettes live in library/palettes (one JSON file each, plus any in a project's library/).
export const THEMES = new Proxy(
  {},
  {
    get: (_, id) => palettes()[id],
    has: (_, id) => id in palettes(),
    ownKeys: () => Object.keys(palettes()),
    getOwnPropertyDescriptor: (_, id) =>
      id in palettes() ? { value: palettes()[id], enumerable: true, configurable: true } : undefined,
  },
);
export const THEME_NOTES = new Proxy({}, { get: (_, id) => paletteNotes()[id] });
const common = {
  title: 'Scene headline',
  kicker: 'Short eyebrow',
  source: 'Visible attribution',
  land: 'Spoken word or local seconds',
  support: 'Supporting line',
};
const emphasis = { emphasis: 'Up to 4 whole-word phrases drawn in the accent color' };
const emphasisStyle = {
  emphasisStyle: 'accent (default) or serif: emphasis phrases set in italic serif, the editorial accent',
};
const align = { align: 'left (default) or center: centre the whole stack' };
const sampleSource = 'Illustrative sample data · replace before publishing';
const b = (name, category, summary, props, example, extra = {}) => ({
  name,
  category,
  summary,
  props: { ...common, ...props },
  example: { ...example, source: example.source ?? sampleSource },
  tail: 1.5,
  ...extra,
});
export const BLOCKS = [
  b(
    'title',
    'story',
    'Open with a clear promise: display type rises line by line under an accent bar.',
    { text: 'Main promise', ...emphasis, ...emphasisStyle, ...align },
    { kicker: 'Field notes', text: 'Make the next step clear', support: 'One idea, supported by evidence.' },
  ),
  b(
    'statement',
    'story',
    'A single editorial statement with optional accent phrases and a supporting line.',
    { text: 'Statement', ...emphasis, ...emphasisStyle, ...align },
    {
      text: 'Busy is not the same as effective.',
      emphasis: ['effective'],
      support: 'Measure the wait, not just the workload.',
    },
  ),
  b(
    'stat',
    'numbers',
    'A hero number with units, counted from a truthful starting value.',
    {
      value: 'Finite number',
      from: 'Starting value',
      prefix: 'Prefix',
      suffix: 'Units',
      decimals: '0–8',
      label: 'Meaning',
      context: 'Context',
      ...align,
    },
    { value: 4.2, suffix: ' days', label: 'Median first response', context: 'From request to first answer.' },
  ),
  b(
    'kpis',
    'numbers',
    'Two to four comparable metrics with staggered entrances.',
    { items: '[{value,label,prefix,suffix,decimals,from,say}]' },
    {
      title: 'The quarter in three numbers',
      items: [
        { value: 12400, label: 'Requests' },
        { value: 4.2, suffix: ' days', label: 'First response' },
        { value: 91, suffix: '%', label: 'Satisfaction' },
      ],
    },
  ),
  b(
    'bars',
    'charts',
    'Accurate zero-based comparison with a tunable focus.',
    {
      data: '[{label,value}] (2–8)',
      max: 'Positive scale maximum',
      format: '{prefix,suffix,decimals} or unit string',
      orientation: 'auto|horizontal|vertical',
      sort: 'none|desc',
      growSay: 'Growth cue',
      focus: '{label|index,say,dim,dur,note}',
    },
    {
      title: 'Where the hours went',
      data: [
        { label: 'Triage', value: 12 },
        { label: 'Routing', value: 24 },
        { label: 'Review', value: 8 },
      ],
      format: ' h',
      focus: { label: 'Routing', dim: 0.55, note: 'Start here' },
    },
  ),
  b(
    'line',
    'charts',
    'A progressive time-series reveal on an explicit scale.',
    {
      series: '[number] or [{x,y}]',
      labels: '[string]',
      min: 'Scale minimum',
      max: 'Scale maximum',
      format: '{prefix,suffix,decimals} or units',
      drawSay: 'Reveal cue',
    },
    {
      title: 'A trend worth watching',
      series: [12, 15, 14, 18, 23, 27],
      labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
      min: 0,
      max: 30,
      format: ' k',
    },
  ),
  b(
    'waffle',
    'charts',
    'Countable units for a share or probability; tiles fill one by one, optionally as icons.',
    {
      value: 'Highlighted units',
      total: 'Total units (1–100)',
      cols: 'Columns',
      label: 'Meaning',
      icon: 'Optional icon per unit (pictogram), see icons',
    },
    { title: 'Seven in ten', value: 70, total: 100, cols: 10, label: 'A forecast, not a guarantee' },
  ),
  b(
    'ring',
    'charts',
    'A single proportion with an exact counter and units.',
    { value: 'Numerator', max: 'Denominator', decimals: '0–8', label: 'Meaning' },
    { title: 'Inside the target window', value: 82, max: 100, label: 'of incidents resolved' },
  ),
  b(
    'delta',
    'numbers',
    'Before and after: the new value counts from the old one; the change chip can carry meaning.',
    {
      from: '{value,label}',
      to: '{value,label}',
      prefix: '',
      suffix: '',
      decimals: '0–8',
      change: 'Optional explicit change label',
      better: 'up|down: colors the change positive or negative',
    },
    {
      title: 'A faster first response',
      from: { value: 4.2, label: 'Before' },
      to: { value: 1.8, label: 'After' },
      suffix: ' days',
      better: 'down',
    },
  ),
  b(
    'compare',
    'decisions',
    'Two approaches with matched criteria and a verdict.',
    { left: '{title,items:[string]}', right: '{title,items:[string]}', verdict: 'Decision' },
    {
      title: 'Choose the right trade-off',
      left: { title: 'One large release', items: ['More coordination', 'Long feedback loop'] },
      right: { title: 'Smaller releases', items: ['Frequent feedback', 'Lower change risk'] },
      verdict: 'Prefer smaller, reversible steps.',
    },
  ),
  b(
    'steps',
    'diagrams',
    'A connected process revealed in sequence.',
    { items: '[{title,detail,say}] (2–5)' },
    {
      title: 'From request to resolution',
      items: [
        { title: 'Capture', detail: 'State the need' },
        { title: 'Route', detail: 'Find the owner' },
        { title: 'Resolve', detail: 'Confirm the outcome' },
      ],
    },
  ),
  b(
    'timeline',
    'diagrams',
    'Events on an ordered rail with time labels.',
    { items: '[{label,title,detail,say}] (2–5)' },
    {
      title: 'How the response unfolded',
      items: [
        { label: '09:10', title: 'Detected', detail: 'Alert received' },
        { label: '09:18', title: 'Contained', detail: 'Traffic rerouted' },
        { label: '09:42', title: 'Recovered', detail: 'Service verified' },
      ],
    },
  ),
  b(
    'funnel',
    'charts',
    'Decreasing stages on one comparable scale with derived step-to-step rates.',
    {
      items: '[{label,value,say}] (2–5)',
      format: '{prefix,suffix,decimals} or units',
      rates: 'Show conversion between stages (default true)',
    },
    {
      title: 'Find the drop-off',
      items: [
        { label: 'Visited', value: 1000 },
        { label: 'Started', value: 620 },
        { label: 'Finished', value: 440 },
      ],
    },
  ),
  b(
    'quote',
    'story',
    'A sourced human voice in light display type with an oversized mark.',
    { text: 'Quotation', author: 'Attribution', role: 'Context', ...emphasis },
    {
      text: 'The best handoff is the one nobody has to chase.',
      author: 'Illustrative interview',
      role: 'Fictional quotation for this template',
    },
  ),
  b(
    'list',
    'text',
    'A short staged checklist or set of takeaways.',
    { items: '[string or {text,say}] (2–5)' },
    { title: 'Three things to remember', items: ['Name the owner', 'Make the next step clear', 'Close the loop'] },
  ),
  b(
    'matrix',
    'decisions',
    'A compact comparison grid for two to four criteria; one column can be highlighted.',
    { columns: '[string] (2–3)', rows: '[{label,values:[string]}] (2–4)', highlight: 'Column index to highlight' },
    {
      title: 'Evaluate the whole workflow',
      columns: ['Option A', 'Option B'],
      rows: [
        { label: 'Setup', values: ['Low', 'Medium'] },
        { label: 'Iteration', values: ['Medium', 'Low'] },
        { label: 'Control', values: ['Limited', 'High'] },
      ],
    },
  ),
  b(
    'equation',
    'diagrams',
    'Build a simple relationship, then show its implication.',
    { expression: 'Formula', result: 'Result', explanation: 'Meaning' },
    {
      title: 'Leave room for variation',
      expression: 'Capacity − demand',
      result: '= headroom',
      explanation: 'Headroom absorbs the unexpected.',
    },
  ),
  b(
    'callout',
    'text',
    'A framed correction, caveat or key insight with an optional icon badge.',
    { text: 'Insight', label: 'Label', icon: 'Optional badge icon', ...emphasis },
    {
      label: 'The caveat',
      icon: 'alert',
      text: 'An average can hide a long tail.',
      emphasis: ['long tail'],
      support: 'Look at the distribution before choosing a target.',
    },
  ),
  b(
    'endcard',
    'story',
    'A deliberate ending; the next step becomes a call-to-action pill.',
    { text: 'Final takeaway', action: 'Next step', ...emphasis, ...emphasisStyle, ...align },
    {
      title: 'Make the next step smaller.',
      support: 'Start with one handoff this week.',
      action: 'Choose an owner. Measure the wait.',
    },
  ),
  b(
    'image',
    'media',
    'A real or generated plate at its own aspect ratio, in a rounded mask.',
    {
      asset: 'Declared image asset id',
      file: 'Local image path',
      caption: 'Visible caption',
      label: 'Provenance label',
      fit: 'contain (default) or cover',
      drift: 'Slow push-in (true/false)',
    },
    { file: 'assets/demo.png', caption: 'A consistent palette connects the scenes.', label: 'Illustrative artwork' },
  ),
  b(
    'video',
    'media',
    'A short footage insert with native titles and a shared soundtrack.',
    {
      asset: 'Declared clip asset id',
      file: 'Local video path',
      caption: 'Visible caption',
      label: 'Provenance label',
      offset: 'Source in point in seconds',
      fit: 'contain (default) or cover',
      drift: 'Slow push-in (true/false)',
    },
    { file: 'assets/demo.mp4', caption: 'One continuous visual language', label: 'Illustrative footage', offset: 0 },
  ),
  b(
    'kinetic',
    'speech',
    'Speech-following words: highlight a phrase, reveal words, one at a time, or stack them as poster type that builds as spoken.',
    {
      mode: 'highlight|reveal|word|stack',
      align: 'left|center (stack defaults to center)',
      emphasis: 'stack: words drawn larger in the accent (whole words from the narration)',
      emphasisStyle: 'stack: bold (default) or serif italic emphasis words',
      upper: 'stack: set in capitals (true/false)',
      maxWords: 'Words per phrase (1–16; stack pages whole sentences, up to 14 words, by default)',
      maxGap: 'Start a new phrase after this silence, 0–5 seconds (default 0.6)',
      maxDuration: 'Maximum phrase span, 0.5–15 seconds (default 4); never split a timed word',
    },
    { mode: 'highlight', align: 'left', maxWords: 6, source: '' },
    { vo: 'Make every word land exactly when you hear it.' },
  ),
  b(
    'icon-grid',
    'graphics',
    'A paced composition of licensed vector icons, labels and optional details.',
    {
      items: '[{icon,label,detail?,say?}] (1–8)',
      columns: '1–4; automatic if omitted',
      stagger: 'Delay between arrivals, 0–2 seconds',
    },
    {
      title: 'Pack for a curious afternoon',
      items: [
        { icon: 'book-open', label: 'Read', detail: 'Bring a field guide' },
        { icon: 'camera', label: 'Notice', detail: 'Record a small detail' },
        { icon: 'compass', label: 'Explore', detail: 'Choose a new path' },
        { icon: 'pencil', label: 'Reflect', detail: 'Keep a short note' },
      ],
    },
  ),
  b(
    'flow',
    'diagrams',
    'Draw connections as a process unfolds; each node can follow a spoken cue.',
    {
      nodes: '[{icon?,label,detail?,say?}] (2–6)',
      orientation: 'auto|horizontal|vertical; portrait stays vertical',
      stagger: 'Delay between arrivals, 0–2 seconds',
    },
    {
      title: 'From observation to explanation',
      nodes: [
        { icon: 'leaf', label: 'Notice', detail: 'Start with a question' },
        { icon: 'microscope', label: 'Test', detail: 'Change one thing' },
        { icon: 'lightbulb', label: 'Explain', detail: 'Compare the evidence' },
      ],
    },
  ),
  b(
    'cycle',
    'diagrams',
    'A repeating process with a moving marker on a continuous loop.',
    { nodes: '[{icon?,label}] (3–6)', period: 'Seconds per loop, 2–60', clockwise: 'true or false' },
    {
      title: 'A creative practice',
      nodes: [
        { icon: 'lightbulb', label: 'Imagine' },
        { icon: 'pencil', label: 'Make' },
        { icon: 'camera', label: 'Observe' },
        { icon: 'brush', label: 'Refine' },
      ],
      period: 8,
    },
  ),
  b(
    'breathing',
    'motion',
    'An expanding and contracting ring with explicit, editable phase durations.',
    {
      phases: '[{label,seconds,scale:expand|hold|contract}] (2–6)',
      minScale: 'Minimum relative radius, 0.2–1',
      maxScale: 'Maximum relative radius, 0.2–1, greater than minScale',
      ring: 'Show outer guide ring',
    },
    {
      title: 'Take a quiet moment',
      phases: [
        { label: 'Breathe in', seconds: 3, scale: 'expand' },
        { label: 'Breathe out', seconds: 4, scale: 'contract' },
      ],
      minScale: 0.55,
      maxScale: 1,
      ring: true,
      source: 'Illustrative pacing · adjust to your comfort',
    },
  ),
  b(
    'chapter',
    'story',
    'A section opener: an oversized number, a rule that sweeps and the chapter title.',
    { number: 'Short marker such as 01 or II (≤ 4 characters)', text: 'Alias of title', ...emphasis, ...align },
    { number: '01', title: 'Where the time goes', support: 'Three places a request waits.' },
  ),
  b(
    'highlight',
    'text',
    'A sentence whose key phrases get a marker sweep, each on its own cue.',
    { text: 'Sentence (≤ 200 characters)', phrases: '[string or {text,say}] (1–4 whole-word parts of text)', ...align },
    {
      text: 'An average can hide a long tail of slow requests.',
      phrases: ['long tail'],
      support: 'Look at the distribution, not just the middle.',
    },
  ),
  b(
    'donut',
    'charts',
    'Part-to-whole: segments sweep in order; the legend states each value and share.',
    {
      segments: '[{label,value}] (2–6)',
      format: '{prefix,suffix,decimals} or unit string',
      center: 'Short caption under the total',
    },
    {
      title: 'Where a week of support goes',
      segments: [
        { label: 'Answering', value: 18 },
        { label: 'Routing', value: 12 },
        { label: 'Waiting on others', value: 7 },
        { label: 'Follow-up', value: 3 },
      ],
      format: ' h',
      center: 'hours per week',
    },
  ),
  b(
    'magnitude',
    'charts',
    'Area-true squares for quantities that differ by orders of magnitude.',
    { items: '[{label,value,say}] (2–4, positive)', format: '{prefix,suffix,decimals} or unit string' },
    {
      title: 'The same question, three scales',
      items: [
        { label: 'A team', value: 12 },
        { label: 'A company', value: 1200 },
        { label: 'A city', value: 90000 },
      ],
      format: ' people',
    },
  ),
  b(
    'checklist',
    'text',
    'Items appear unchecked, then each box fills and ticks on its cue.',
    { items: '[string or {text,detail,say}] (2–6)' },
    {
      title: 'Before you publish',
      items: [
        { text: 'Replace every sample figure' },
        { text: 'Add a visible source' },
        { text: 'Listen with the sound on' },
      ],
    },
  ),
  b(
    'canvas',
    'graphics',
    'Draw anything: shapes, paths, text, icons and images that draw on, pop, travel along paths, loop and leave on spoken cues.',
    {
      view: '"auto" (fit the drawing into the content area, up to 2×), [width, height] author units fitted below the header, a camera rect [x, y, width, height] framed across the whole frame, or omit for frame pixels (1920×1080 landscape)',
      viewFrom: 'Camera rect the view travels from (set automatically between world beats)',
      viewAt: 'Scene seconds the camera move starts (default 0)',
      viewDur: 'Seconds the camera move takes (default 1.2)',
      viewDrift: 'After arriving, the camera keeps easing in by this fraction of the view (worlds default 0.03)',
      viewTall: 'Camera rect for tall (vertical) frames; otherwise the view is re-framed on the beat’s own foreground',
      world:
        'Name shared by consecutive canvas beats that form one continuous drawing: each inherits what came before, cuts invisibly, and the camera travels between their views',
      elements:
        '[{type: rect|circle|ellipse|line|path|poly|text|icon|image|group|meter|spotlight|particles|solid, geometry, fill, stroke, width, enter, say|at, dur, keys, loop, along, exit, exitSay|exitAt, z, blur, shine, tilt, material, mosaic, print}] (≤ 600) — see docs/canvas.md',
      stagger: 'Seconds between top-level elements without a cue (0–3)',
      rough:
        'Hand-drawn strokes for every shape: true or {amount, passes, boil, fill: hachure|solid, gap} (an element can set rough: false)',
      mosaic:
        'Lay every shape in tiles: true or {tile, gap, jitter, flow: rows|rings|contour, style: tesserae|pixel|stitch, outline, build: sweep|radial|random, shade, shine, grout, axis} (an element can set mosaic: false)',
      print:
        'Print every shape: benday|halftone|engraving|newsprint|letterpress or {screen: dots|lines|none, cell, angle, tone, axis, register: [dx, dy], wear, ink} (an element can set print: false)',
      dolly:
        'Fly the camera through depth: keys [{say|at, z, dur, ease}]. Elements with z are drawn in perspective; the camera passes them as its z reaches theirs',
      focus:
        'Depth of field for elements with z: {z (the focus plane), aperture 0–3 (1 natural), keys [{say|at, z, dur}] for a rack focus}',
      chart:
        'A chart drawn as canvas shapes with stable ids, so consecutive canvas charts morph into each other (a number into its bar, a stacked bar into bars): {kind: bars|stack|number, values: [{label, value, highlight, id}], box: [x, y, w, h], max, prefix, suffix, decimals, id, note: {text, to, say}} (the note replaces a heading: an annotation on the stressed word)',
      sketch:
        'A library sketch drawn under any elements, redrawn for this frame (clearframe sketch lists them); its camera (view, dolly, focus) applies unless the beat sets its own',
      sketchText: 'Replacement words for a sketch’s placeholder type: {"TITLE": "Your words"}',
      seed: 'Varies a sketch’s seeded layout (buildings, ridges, swell)',
      plates:
        'A generated depth plate set staged in depth: the id of an image asset declared with layers: true (its far, mid and near layers at z 6, 1.2 and -0.35), under any elements; adds a slow dolly unless the beat sets a camera',
    },
    {
      title: 'How an idea spreads',
      view: [1600, 640],
      stagger: 0.12,
      elements: [
        {
          type: 'circle',
          cx: 170,
          cy: 470,
          r: 70,
          fill: 'none',
          stroke: 'accent',
          width: 3,
          opacity: 0.5,
          enter: 'pop',
          loop: { type: 'pulse', period: 1.8, amount: 0.12 },
        },
        {
          type: 'path',
          d: 'M 170 470 C 520 470 640 150 1030 170 S 1350 160 1430 150',
          stroke: 'accent',
          width: 8,
          arrow: 'end',
          dur: 1.4,
        },
        { type: 'circle', cx: 170, cy: 470, r: 36, fill: 'accent' },
        { type: 'text', text: 'One idea', x: 170, y: 590, size: 40, anchor: 'middle', fill: 'ink' },
        {
          type: 'group',
          at: 1.2,
          stagger: 0.18,
          children: [
            { type: 'circle', cx: 700, cy: 300, r: 22, fill: 'accent2' },
            { type: 'circle', cx: 900, cy: 190, r: 22, fill: 'accent2' },
            { type: 'circle', cx: 1180, cy: 160, r: 22, fill: 'accent2' },
          ],
        },
        { type: 'circle', cx: 1430, cy: 150, r: 48, fill: 'accent2', at: 1.9 },
        { type: 'text', text: 'Adopted', x: 1430, y: 260, size: 40, anchor: 'middle', fill: 'ink', at: 2.1 },
        {
          type: 'circle',
          cx: 170,
          cy: 470,
          r: 12,
          fill: 'ink',
          enter: 'fade',
          at: 1.6,
          along: { d: 'M 170 470 C 520 470 640 150 1030 170 S 1350 160 1430 150', dur: 1.6 },
        },
      ],
    },
  ),
  b(
    'annotate',
    'media',
    'A screenshot or photo with numbered pins, a matching legend and an optional focus region.',
    {
      asset: 'Declared image asset id',
      file: 'Local image path',
      pins: '[{x,y,label,detail,say}] (1–6; x/y 0–1 across the image)',
      focus: '{x,y,w,h,say} region to spotlight (0–1)',
      caption: 'Visible caption',
      label: 'Provenance label',
    },
    {
      title: 'Read the dashboard in order',
      file: 'assets/demo.png',
      pins: [
        { x: 0.29, y: 0.21, label: 'Start with the total', detail: 'The number everything adds up to' },
        { x: 0.51, y: 0.52, label: 'Then the outlier', detail: 'The week that needs a decision' },
      ],
      focus: { x: 0.19, y: 0.36, w: 0.51, h: 0.56 },
      caption: 'Illustrative wireframe · replace with an approved screenshot',
    },
  ),
];
export const blockByName = name => BLOCKS.find(b => b.name === name);
export const MOTIONS = ['gentle', 'snappy', 'spring'];
export const TRANSITIONS = ['cut', 'fade', 'rise', 'wipe', 'push', 'zoom', 'panel', 'iris', 'whip', 'flash', 'dissolve'];
export const BACKDROPS = ['none', 'dots', 'grid', 'glow', 'paper', 'mosaic'];
export const CANVASES = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
  [1080, 1350],
  [640, 360],
];
export const FRAME_RATES = [24, 25, 30, 50, 60];
const words = value =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
const wordChar = c => c != null && /[\p{L}\p{N}]/u.test(c);
/** Index of a whole-word phrase in whitespace-normalised text, or -1 (mirrors the renderer). */
export function findPhrase(text, phrase) {
  const t = words(text),
    q = words(phrase);
  if (!q) return -1;
  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1))
    if (!wordChar(t[i - 1]) && !wordChar(t[i + q.length])) return i;
  return -1;
}
export const precision = value => {
  const [n, e = '0'] = String(value).split(/e/i);
  return Math.min(8, Math.max(0, (n.split('.')[1]?.length ?? 0) - Number(e)));
};

export function palette(theme = 'paper') {
  if (typeof theme === 'string') {
    if (!THEMES[theme]) throw new Error(`Unknown native theme ${theme}`);
    return { base: theme, ...THEMES[theme] };
  }
  if (!theme || typeof theme !== 'object' || Array.isArray(theme))
    throw new Error('theme must be a preset name or a palette object');
  const base = theme.base ?? 'paper';
  const result = palette(base);
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'base') continue;
    if (!PALETTE_KEYS.includes(key) || !/^#[\da-f]{6}$/i.test(value))
      throw new Error(`theme.${key}: expected a palette color in #RRGGBB form`);
    result[key] = value;
  }
  return result;
}

export function normalizeProps(name, input = {}, { vertical = false, width, height, assets = [] } = {}) {
  const meta = blockByName(name);
  if (!meta) throw new Error(`No native block "${name}". Run clearframe blocks; legacy scenes need an explicit port.`);
  const p = structuredClone(input);
  const fail = message => {
    throw new Error(`${name}: ${message}`);
  };
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('props must be an object');
  for (const key of Object.keys(p)) if (!(key in meta.props)) fail(`unsupported prop ${key}`);
  const h = helpers(p, fail, { findPhrase, precision });
  // Checks every block shares: text lengths, one headline, alignment and emphasis phrases.
  for (const key of [
    'title',
    'kicker',
    'source',
    'support',
    'text',
    'label',
    'context',
    'caption',
    'author',
    'role',
    'verdict',
    'expression',
    'result',
    'explanation',
    'action',
  ])
    h.text(p[key], key, key === 'text' ? (name === 'highlight' ? 200 : 240) : key === 'title' ? 90 : 160);
  h.text(p.number, 'number', 4);
  h.text(p.center, 'center', 30);
  if (name === 'chapter' && p.text != null) {
    if (p.title != null) fail('use title or text, not both');
    p.title = p.text;
    delete p.text;
  }
  // Hero blocks show one headline: `text` and `title` are aliases, so both would drop one.
  if (['title', 'statement', 'endcard'].includes(name) && p.text != null && p.title != null)
    fail('use text or title, not both');
  if (name === 'highlight' && p.title != null)
    fail('highlight shows its text only; put a heading in kicker or a separate beat');
  if (name === 'stat' && p.context != null && p.support != null) fail('use context or support, not both');
  if (name !== 'kinetic') {
    if (p.align != null && !['left', 'center'].includes(p.align)) fail('align must be left or center');
    if (p.emphasisStyle != null) {
      if (!['accent', 'serif'].includes(p.emphasisStyle)) fail('emphasisStyle must be accent or serif');
      if (!p.emphasis) fail('emphasisStyle needs emphasis phrases');
    }
    if (p.emphasis != null) {
      if (!Array.isArray(p.emphasis) || p.emphasis.length < 1 || p.emphasis.length > 4)
        fail('emphasis needs 1–4 phrases');
      p.emphasis.forEach(e => {
        h.text(e, 'emphasis', 60);
        if (findPhrase(p.text ?? p.title, e) < 0) fail(`emphasis "${e}" must be whole words from the text`);
      });
    }
  }
  VALIDATORS[name]?.(p, h, {
    vertical,
    width: width ?? (vertical ? 1080 : 1920),
    height: height ?? (vertical ? 1920 : 1080),
    assets,
  });
  if (p.decimals != null && (!Number.isInteger(p.decimals) || p.decimals < 0 || p.decimals > 8))
    fail('decimals must be 0–8');
  return p;
}

export function markdownCatalog() {
  return (
    '# Native block reference\n\nGenerated by `clearframe blocks --md`. All blocks render in FFFrames.\n\n' +
    BLOCKS.map(
      b =>
        `## ${b.name}\n\n${b.summary}\n\n| Prop | Meaning |\n|---|---|\n${Object.entries(b.props)
          .map(([k, v]) => `| ${k} | ${v.replaceAll('|', ' / ')} |`)
          .join(
            '\n',
          )}\n\n\`\`\`json\n${JSON.stringify({ id: b.name, block: b.name, vo: b.vo ?? 'Replace this narration.', props: b.example }, null, 2)}\n\`\`\`\n`,
    ).join('\n')
  );
}
