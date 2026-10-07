// Discovery: one compact, searchable index over everything a film can be built from — native
// blocks, canvas sketches, playbooks, directions, treatments, palettes, type voices, sculptures,
// cast moves, shapes and looks, stage mechanisms, film mechanisms and the curated examples.
//
// It is generated from each thing's own definition (and a project's or shared library's
// overrides, through items()), so nothing is described twice and nothing drifts: blocks from the
// catalog, library items from their files, cast shapes and looks from cast.mjs, cast moves and
// stage elements from the tables in docs/cast.md and docs/scene-engine.md, examples from their
// READMEs. `find(query)` returns a short mixed shortlist; `detail(id)` returns the exact
// authoring details for one entry.
import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS } from './catalog.mjs';
import { items, libraryDirs, LIBRARY } from './library.mjs';
import { sketchByName } from './sketches.mjs';
import { CAST_CATALOG } from './cast.mjs';
import { ICONS } from './icons.mjs';

const ROOT = path.dirname(LIBRARY);
const read = rel => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return '';
  }
};
const firstSentence = t => (String(t ?? '').match(/^[\s\S]*?[.!?](\s|$)/)?.[0] ?? String(t ?? '')).trim();
const clean = t => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Rows of the Markdown table that follows `heading` whose first cell names `ids`: [[ids], text]. */
function tableRows(doc, heading) {
  const lines = doc.split('\n'), out = [];
  let i = lines.findIndex(l => l.startsWith(heading));
  if (i < 0) return out;
  for (i++; i < lines.length && !/^#{1,3} /.test(lines[i]); i++) {
    const m = lines[i].match(/^\| ((?:`[^`]+`(?:, )?)+) \| (.+) \|$/);
    if (m) out.push([[...m[1].matchAll(/`([^`]+)`/g)].map(x => x[1]), clean(m[2])]);
  }
  return out;
}

// A copyable cast for each move: the objects it needs and the move in context (fill and emerge
// span beats, so theirs is a three-beat sequence).
const OBJ = { a: { id: 'a', shape: 'doc', color: 'accent' }, b: { id: 'b', shape: 'person', color: 'surface' }, c: { id: 'c', shape: 'server', color: 'accent2' }, d: { id: 'd', shape: 'box', color: 'accent2' } };
const ROW = { form: 'line', ids: ['a', 'b', 'c'], at: 0 };
const castOf = (formations, extra = []) => ({ block: 'canvas', props: { cast: { look: 'drawn', objects: [OBJ.a, OBJ.b, OBJ.c, ...extra], formations } } });
const MOVES = {
  scatter: castOf([{ form: 'scatter', ids: ['a', 'b', 'c'], at: 0 }]),
  line: castOf([{ ...ROW, thread: true }]),
  ring: castOf([{ form: 'ring', ids: ['a', 'b', 'c'], at: 0 }]),
  cluster: castOf([{ form: 'cluster', ids: ['a', 'b', 'c'], at: 0 }]),
  hero: castOf([ROW, { form: 'hero', hero: 'b', word: 'The one who decides', say: 'decides' }]),
  swap: castOf([ROW, { form: 'swap', out: 'a', in: 'd', by: ['b'], say: 'becomes' }], [OBJ.d]),
  wave: castOf([ROW, { form: 'wave', ids: ['a', 'b', 'c'], say: 'runs' }]),
  travel: castOf([ROW, { form: 'travel', ids: ['a'], to: 'c', say: 'goes', dur: 1.2 }]),
  merge: castOf([ROW, { form: 'merge', ids: ['a', 'b'], into: 'c', say: 'folds' }]),
  split: castOf([{ form: 'cluster', ids: ['c'], at: 0 }, { form: 'split', from: 'c', ids: ['a', 'b'], say: 'fans' }]),
  camera: castOf([ROW, { form: 'camera', zoom: 1.6, on: 'b', say: 'closer' }, { form: 'camera', zoom: 1, say: 'back' }]),
  exit: castOf([ROW, { form: 'exit', ids: ['a'], say: 'leaves' }]),
  mark: castOf([ROW, { form: 'mark', mark: 'circle', ids: ['b'], say: 'matters' }, { form: 'mark', mark: 'arrow', ids: ['a'], to: 'c', say: 'feeds' }]),
};
MOVES.fill = MOVES.emerge = { beats: [
  castOf([ROW, { form: 'fill', ids: ['a'], say: 'opens', dur: 0.9 }]),
  { block: 'stat', note: 'any block: it plays on the object\'s colour as its tone' },
  { block: 'canvas', props: { cast: { formations: [{ form: 'emerge', ids: ['a'], at: 0 }, { ...ROW, at: 1 }] } } },
] };

// Film-level mechanisms: how a scene can carry an idea beyond one block. Each names its reference.
const MECHANISMS = [
  ['cast', 'Persistent objects that carry a story across cuts: they gather, queue, rank, travel, merge, split, swap one thing for another and hand the frame to the next scene.', 'a process, a flow of requests, a before/after, a journey, the same objects regrouped into a new arrangement (sorted, ranked, merged, split), anything with actors that change', 'canvas props.cast', 'docs/cast.md',
    { block: 'canvas', props: { cast: { look: 'drawn', objects: [{ id: 'a', shape: 'ticket', color: 'accent' }, { id: 'b', shape: 'person', color: 'surface' }], formations: [{ form: 'line', at: 0 }, { form: 'travel', ids: ['a'], to: 'b', say: 'reaches' }] } } }],
  ['stage', 'A native GPU stage: actors with stable identities, links that follow them, packets, callouts, commit-grounded code, footage, materials, particles and a 2.5D camera.', 'systems that change over time, technical and PR explainers, architecture', 'block stage, or film stages', 'docs/scene-engine.md',
    { block: 'stage', props: { actors: [{ id: 'app', label: 'App', kind: 'client', x: 460, y: 600, at: 0.2 }, { id: 'api', label: 'API', kind: 'service', x: 1060, y: 600, at: 0.4 }, { id: 'db', label: 'Database', kind: 'database', x: 1560, y: 600, at: 0.6 }],
      links: [{ id: 'app-api', from: 'app', to: 'api' }, { id: 'api-db', from: 'api', to: 'db' }],
      events: [{ do: 'send', from: 'app', to: 'api', label: 'request', say: 'asks' }, { do: 'state', actor: 'api', status: 'active', say: 'checks' }, { do: 'send', from: 'api', to: 'db', say: 'reads' }] } }],
  ['code-scene', 'A code change as one scene: a stage holding only code makes the editor the picture, changed lines lighting up on a spoken word; long lines wrap readably on phones.', 'a pull request, a fix, a before/after in code', 'block stage, props.code', 'docs/scene-engine.md',
    { block: 'stage', props: { code: { title: 'parser.mjs', before: 'if (x) return;', after: 'if (x == null) return;', say: 'null' } } }],
  ['diagram', 'A system diagram that lays itself out for the frame: components, ranks and flows, editable by id.', 'architecture, how parts connect, data paths', 'canvas props.diagram; sketch architecture | state-machine | component-change prints one to edit', 'docs/system-diagrams.md', { block: 'canvas', props: { sketch: 'architecture' } }],
  ['graph', 'How an input changes an output: a curve from a stated formula, a point that rides it as the input moves, dashed guides to both axes, and labelled marks. Shows a shape, not data (no tick numbers).', 'dose and response, price and demand, practice and skill (diminishing returns), how busy a system is and how long you wait (a queue), growth that compounds, a cycle', 'canvas props.graph: fn {kind: linear|power|exponential|logistic|saturating|log|queue|wave|bell, …params}, x, y labels, sweep {from,to,say}, marks', 'docs/canvas.md',
    { block: 'canvas', props: { graph: { fn: { kind: 'queue', measure: 'waiting' }, x: { domain: [0, 0.95], label: 'How busy the desk is' }, y: { label: 'People waiting' }, sweep: { from: 0.1, to: 0.92, say: 'busier', dur: 3 }, marks: [{ x: 0.5, label: 'half busy', say: 'half' }] } } }],
  ['accumulate', 'Small amounts adding up: a rate over time is cut into equal steps that appear in order under the curve, then lift and stack into one column whose height is their sum (normalised, not on the rate axis).', 'savings or debt building up, rain filling a reservoir, small daily habits compounding into a result, distance from speed, a backlog growing from a steady inflow', 'canvas props.accumulate: rate {kind,…}, steps 4–24, rateLabel, totalLabel, fill {say}, stack {say}', 'docs/canvas.md',
    { block: 'canvas', props: { accumulate: { rate: { kind: 'saturating', L: 1, k: 3 }, x: { domain: [0, 1], label: 'Weeks' }, rateLabel: 'Saved each week', totalLabel: 'Saved so far', steps: 12, fill: { say: 'each' }, stack: { say: 'together' } } } }],
  ['estimate', 'Noisy measurements settling into an estimate: simulated readings scatter around a value, their running average steadies, a band of ±1 standard error narrows with more of them, and the same dots gather into the spread of outcomes. More samples shrink random error, assuming independent, fairly drawn samples; they do not remove bias. Labelled Simulated.', 'why the average of a few reviews or survey answers swings by chance and many swing less (if they are a fair sample), sensor or lab readings averaging out, why an A/B test needs enough users to see past noise (not past a flawed setup), sampling error in a poll (not who was asked), why one bad week is not a trend', 'canvas props.estimate: value, spread, bias, count 8–60, seed, label, meanLabel, trueLabel, show {say,dur}, gather {say}', 'docs/canvas.md',
    { block: 'canvas', props: { estimate: { count: 36, seed: 11, label: 'Each review', meanLabel: 'Average so far', trueLabel: 'What it is really like', show: { say: 'arrive', dur: 4 }, gather: { say: 'spread' } } } }],
  ['field', 'Where things flow: arrows show the push at every point of a flow field and particles follow its numerically integrated streamlines at a constant pace (routes follow the field; speeds do not), so where things end up is a consequence of the field. The field is a chosen shape, not a fitted model.', 'wind and currents, optimisation sliding downhill (a valley), a cycle that keeps going (a swirl); as a qualitative metaphor only, not a validated crowd or market simulation: shoppers drifting toward a checkout or a market settling to equilibrium (a sink), two pulls in tension (a saddle)', 'canvas props.field: kind drift|swirl|source|sink|saddle|valley, particles, flow {say,dur}, labels [{text,pos}]', 'docs/canvas.md',
    { block: 'canvas', props: { field: { kind: 'sink', particles: 18, flow: { say: 'drift', dur: 4 }, labels: [{ text: 'checkout', pos: [0, -0.15] }] } } }],
  ['rate-functions', 'Motion with character, from Manim\'s rate functions (MIT): thereAndBack (go and return: point at a thing), wiggle (draw the eye), runningStart (pull back, then go), overshoot, rushInto, rushFrom, lingering, doubleSmooth, smooth, decay.', 'a nudge that returns, a highlight that pulses once, a move with anticipation, a settle that overshoots', 'ease on any key or route: {ease: "thereAndBack"}', 'scene/native/THIRD_PARTY.md',
    { block: 'canvas', props: { elements: [{ type: 'circle', cx: 960, cy: 540, r: 80, fill: 'accent', origin: [960, 540], keys: [{ say: 'this', scale: 1.4, dur: 0.6, ease: 'thereAndBack' }] }] } }],
  ['board', 'Several pictures as panels of one world (place: [x, y]): the camera holds close on each, travels across the gaps, then pulls back to show them side by side, each still alive: the relation between each detail and the whole.', 'a showreel, a recap, a product tour, a story in a few moments, "together they are…"', 'canvas props.world + view + place', 'docs/canvas.md',
    { beats: [
      { block: 'canvas', props: { world: 'board', view: [0, 0, 1920, 1080], place: [0, 0], sketch: 'desk' } },
      { block: 'canvas', props: { world: 'board', view: [2080, 0, 1920, 1080], place: [2080, 0], sketch: 'rooftops' } },
      { block: 'canvas', props: { world: 'board', view: [-260, -530, 4520, 2543], elements: [{ type: 'text', text: 'The line that ties them together', x: 1960, y: 1400, size: 150, anchor: 'middle', say: 'together' }] } },
    ], note: 'place moves and scales a drawing but does not clip it: cover gaps with bg rects in the last beat if a drawing spills. Words the whole view would shrink should exitAt after their beat.' }],
  ['world', 'One drawing the camera travels through across several scenes (world + view), so the film moves through a place instead of cutting between slides.', 'a journey, a process in stations, a map, a pull-back to the whole', 'canvas props.world + view', 'docs/canvas.md', null],
  ['tone-handoff', 'An object fills the frame with its colour and the next scene (any block) plays on that colour; emerge brings it back.', 'zooming into a detail, a chart becoming its number, a report becoming its code', 'cast fill / emerge', 'docs/cast.md', MOVES.fill],
  ['art-layer', 'Drawn art under or over any block: an arrow onto a bar, a circle round a word, soft shapes behind a quote.', 'pointing at the part that matters on a chart or card', 'beat art.under / art.over', 'docs/canvas.md', null],
  ['depth-plates', 'Painted depth plates (generated stills split into layers) put the camera inside a place; never carry text or numbers.', 'places, moods, establishing shots', 'canvas plates, layered assets', 'docs/image-direction.md', null],
  ['dither-light', 'A 1-bit product shot: shapes on a stage painted with the dither material, an ordered dither in two palette inks under a soft light that drifts across them, on a dithered ground.', 'a retro, game-like or tactile product or object reveal; pixel looks with real light and shade', 'block stage, element material dither (and ground)', 'examples/dither-light/README.md',
    { block: 'stage', props: { ground: { material: 'dither', colors: ['accent2', 'ink'], scale: 2.4, speed: 0.6, opacity: 1 }, elements: [
      { type: 'rect', x: 1200, y: 300, w: 280, h: 470, r: 40, fill: 'bg', material: { name: 'dither', colors: ['bg', 'accent2'], scale: 1.2, speed: 0.6 }, enter: 'rise', say: 'Meet' },
      { type: 'circle', cx: 1600, cy: 660, r: 100, fill: 'bg', material: { name: 'dither', colors: ['bg', 'accent2'], scale: 1.2, speed: 0.6 }, enter: 'rise', at: 0.4 },
      { type: 'text', text: 'Product', x: 200, y: 470, size: 120, font: 'mono', fill: 'bg', enter: 'type', say: 'Meet' }] } }],
  ['kinetic', 'Type that follows the voice word by word, with emphasis words larger in an accent face.', 'quotes, hooks, podcast clips, a line that must land', 'block kinetic', 'docs/speech.md', null],
  ['icons', `A bundled icon set (${ICONS.length} Tabler icons) for canvas elements and cast tiles.`, 'a recognisable thing in one glance', 'canvas icon element, cast object icon', 'film/icons.mjs', null],
];

let cache = null, cacheKey = null;
/** Every entry: {id, kind, name, title, about, when, needs, ref}. Rebuilt when the library layers change. */
/** A sketch's fillable placeholder words and voice-cued moments, read from one drawing (~0.5 ms). */
function slots(name) {
  const text = new Set(), cues = new Set();
  const walk = list => (list ?? []).forEach(el => {
    if (el.type === 'text' && /^[A-Z][A-Z0-9_]{2,}$/.test(el.text)) text.add(el.text);
    for (const c of [el.cue, el.exitCue, el.along?.cue, ...(el.keys ?? []).map(k => k.cue)]) if (c) cues.add(c);
    walk(el.children);
  });
  try { walk(sketchByName(name).build(1920, 1080, {}).elements); } catch {}
  return { text: [...text], cues: [...cues] };
}
const slotText = ({ text, cues }) => [text.length ? `sketchText ${text.join(', ')}` : '', cues.length ? `sketchSay ${cues.join(', ')}` : ''].filter(Boolean).join('; ');

export function entries() {
  const key = libraryDirs().join('|');
  if (cache && cacheKey === key) return cache;
  const out = [];
  const add = (kind, name, title, about, when, needs, ref) => out.push({ id: `${kind}:${name}`, kind, name, title: clean(title || name), about: clean(about), when: clean(when), needs: clean(needs), ref });
  for (const b of BLOCKS) add('block', b.name, b.name, b.summary, b.category, Object.keys(b.props ?? {}).slice(0, 8).join(', '), `blocks ${b.name}`);
  for (const s of items('sketches')) add('sketch', s.id, s.id, s.summary, s.use, [s.layer ? 'background art layer' : 'canvas', slotText(slots(s.id))].filter(Boolean).join('; '), `sketch ${s.id}`);
  for (const p of items('playbooks')) add('playbook', p.id, p.title, `${p.title}: ${p.beats?.length ?? 0} scenes`, p.audience, p.inputs, `new DIR --playbook ${p.id}`);
  for (const d of items('directions')) add('direction', d.id, d.title, d.story, d.when, (d.materials ?? []).join(', '), `new DIR --direction ${d.id}`);
  for (const t of items('treatments')) add('treatment', t.id, t.title, t.title, t.when, '', `new DIR --treatment ${t.id}`);
  for (const t of items('types')) add('type', t.id, t.title, t.title, t.when, '', `"type": "${t.id}"`);
  for (const p of items('palettes')) add('palette', p.id, p.id, p.notes, p.notes, '', `"theme": "${p.id}"`);
  for (const f of fs.existsSync(path.join(LIBRARY, 'sculptures')) ? fs.readdirSync(path.join(LIBRARY, 'sculptures')).filter(f => f.endsWith('.json')) : []) {
    try {
      const s = JSON.parse(read(`library/sculptures/${f}`));
      add('sculpture', f.replace(/\.json$/, ''), s.title, s.description ?? s.use, s.use, 'Blender to prepare new assets', `sculptures; sculpture ${f.replace(/\.json$/, '')}`);
    } catch {}
  }
  for (const [ids, text] of tableRows(read('docs/cast.md'), '| `form` |'))
    for (const name of ids) add('cast-move', name, name, firstSentence(text), text.slice(firstSentence(text).length), 'a cast', 'docs/cast.md');
  for (const s of CAST_CATALOG.shapes) add('cast-shape', s.id, s.id, s.about, s.about, 'a cast object: {"shape": "' + s.id + '"}', 'docs/cast.md');
  for (const l of CAST_CATALOG.looks) add('cast-look', l.id, l.id, l.about, l.about, 'cast look', 'docs/cast.md');
  for (const [ids, text] of tableRows(read('docs/scene-engine.md'), '### Elements'))
    add('stage-element', ids[0].replace(/[^a-z:]+.*$/, '') || ids[0], ids.join(', '), firstSentence(text), text.slice(firstSentence(text).length), 'a stage', 'docs/scene-engine.md');
  for (const [name, about, when, needs, ref] of MECHANISMS) add('mechanism', name, name, about, when, needs, ref);
  for (const dir of fs.existsSync(path.join(ROOT, 'examples')) ? fs.readdirSync(path.join(ROOT, 'examples')) : []) {
    const md = read(`examples/${dir}/README.md`);
    if (!md) continue;
    const title = md.match(/^# (.+)$/m)?.[1] ?? dir, para = md.split('\n\n').find(p => p.trim() && !p.startsWith('#')) ?? '';
    add('example', dir, title, firstSentence(para), firstSentence(para.slice(firstSentence(para).length)), '', `examples/${dir}/README.md`);
  }
  cache = out;
  cacheKey = key;
  return out;
}

// Everyday words people use for what they want, mapped to the words the library uses.
const SYNONYMS = {
  money: 'revenue cost price finance profit payment coin', growth: 'increase rise trend grow up', process: 'flow pipeline steps sequence queue',
  compare: 'versus comparison before after contrast', time: 'timeline history clock deadline latency', people: 'person user customer team',
  data: 'database chart numbers metric records', idea: 'insight bulb inspiration concept', security: 'lock permission privacy vault safe', ship: 'delivery truck logistics box',
  bug: 'fix error incident crash', launch: 'reveal product milestone flag', story: 'narrative journey character', calm: 'quiet gentle soft', energetic: 'punchy fast bold kinetic',
  retro: 'pixel print vintage lcd', playful: 'pixel drawn hand fun', premium: 'cinematic gold glass luxury', code: 'pull request commit diff editor',
  explain: 'explainer concept teaching how why', social: 'vertical short clip hook', email: 'envelope message notification', server: 'backend infrastructure service cloud',
  faster: 'speed latency delta before after', slower: 'latency delay wait delta', cheaper: 'cost delta saving', percent: 'stat delta kpi figure', number: 'stat kpi figure',
  results: 'stat kpi delta proof evidence', quarter: 'kpi quarterly update', quarterly: 'kpi quarterly update numbers', numbers: 'stat kpi bars chart', teaser: 'trailer hook reveal', thank: 'story personal human',
  api: 'service server request backend architecture system', cache: 'database store request service', request: 'packet flow service',
  engineer: 'technical system architecture code', developer: 'technical code system pull', architecture: 'system diagram service',
  sales: 'business customer product', customer: 'person user journey', team: 'people person',
  handmade: 'paper cut drawn tactile craft', tactile: 'paper cut handmade', craft: 'paper cut handmade print', collage: 'paper cut layered',
  private: 'lock security privacy vault safe',
  input: 'graph curve output', output: 'graph curve', changes: 'graph sweep curve', relationship: 'graph curve', curve: 'graph',
  accumulating: 'accumulate total sum', accumulate: 'accumulate total', adds: 'accumulate total', compounding: 'accumulate exponential growth', small: 'accumulate steps',
  spread: 'estimate distribution outcomes', outcomes: 'estimate spread distribution', noisy: 'estimate average measurement', uncertainty: 'estimate spread', average: 'estimate measurement', measurements: 'estimate', reliable: 'estimate average',
  reorganize: 'cast regroup formation morph', reorganise: 'cast regroup formation morph', regroup: 'cast formation', flow: 'field particles streamlines', flows: 'field particles', drift: 'field', forces: 'field',
 connect: 'bridge integration link network', integration: 'bridge connect link', partnership: 'bridge connect people', gap: 'bridge',
  guide: 'maze path onboarding', confusing: 'maze tangle', onboarding: 'maze guide steps', navigate: 'maze path route',
 calendar: 'clock time schedule', app: 'phone product device screen',
};
const words = t => String(t ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
// Words that say nothing about which picture fits.
const STOP = new Set('a an the and or of to in on for with about our your their we it its is are be this that these those how why what show make made video film clip one two second seconds minute minutes long keep keeps some into from at by as so very just'.split(' '));

/**
 * A short, mixed shortlist for what someone wants to make: at most `perKind` from any one kind so
 * a block, a mechanism, a sketch and a playbook can all surface. Each line says what it is and when
 * it fits; detail(id) gives the exact authoring.
 */
export function find(query, { limit = 8, kinds = null, perKind = 3 } = {}) {
  // Plurals read as their singular too ("nights" finds night-shift).
  const q = words(query).filter(w => !STOP.has(w) && !/^\d+$/.test(w)).flatMap(w => w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? [w, w.slice(0, -1)] : [w]);
  // A figure in the brief ("40%", "3x", "$2m") asks for the blocks that show one; a length or a count ("30 seconds") does not.
  if (/\d\s*(%|x\b|×|percent|times\b|k\b|m\b|bn\b|million|billion)|[$€£]\s*\d/i.test(query)) q.push('number', 'stat', 'delta', 'kpi');
  const terms = new Set(q.flatMap(w => [w, ...words(SYNONYMS[w])]));
  const scored = entries()
    .filter(e => !kinds || kinds.includes(e.kind))
    .map(e => {
      const fields = [[`${e.name} ${e.title}`, 4], [e.about, 2], [e.when, 2], [e.needs, 1], [e.kind, 1]];
      let score = 0;
      for (const [text, weight] of fields) {
        const ws = new Set(words(text));
        for (const t of terms) if (ws.has(t) || (t.length > 4 && [...ws].some(w => w.startsWith(t)))) score += q.includes(t) ? weight * 2 : weight;
      }
      return { e, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const per = {}, out = [];
  for (const { e } of scored) {
    if ((per[e.kind] = (per[e.kind] ?? 0) + 1) > perKind) continue;
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** One line per entry: `kind:name — what it is (when).` */
export const line = e => `${e.id} — ${e.about || e.title}${e.when && e.when !== e.about ? ` · when: ${e.when.slice(0, 140)}` : ''}${e.kind === 'sketch' && e.needs.includes('sketch') ? ` · fill: ${e.needs.split('; ').slice(1).join('; ')}` : ''}`;

/** Exact authoring details for one entry: how to use it, a copyable example where one exists, its reference. */
export async function detail(id) {
  const e = entries().find(x => x.id === id || x.name === id);
  if (!e) throw new Error(`No library entry ${id}. Search with find first.`);
  const out = { id: e.id, title: e.title, about: e.about, when: e.when, needs: e.needs, ref: e.ref };
  if (e.kind === 'block') {
    const b = BLOCKS.find(x => x.name === e.name);
    Object.assign(out, { props: Object.keys(b.props ?? {}), example: { block: b.name, props: b.example } });
  } else if (e.kind === 'sketch') {
    // Its placeholder type and named moments, so the example shows what to fill.
    const { text, cues } = slots(e.name);
    out.example = { block: 'canvas', props: { sketch: e.name,
      ...(text.length ? { sketchText: Object.fromEntries(text.map(t => [t, 'your words'])) } : {}),
      ...(cues.length ? { sketchSay: Object.fromEntries(cues.map(c => [c, 'a spoken word'])) } : {}) } };
    out.note = `node engine/cli.mjs sketch ${e.name} prints the elements to adapt.${cues.length ? ' sketchSay lands each named moment on a word of the narration.' : ''}`;
  } else if (e.kind === 'playbook') {
    const p = items('playbooks').find(x => x.id === e.name);
    out.scenes = p.beats.map(b => `${b.id} (${b.block}${b.props?.sketch ? `: ${b.props.sketch}` : ''})${b.vo ? `: ${clean(b.vo).slice(0, 80)}` : ''}`);
    out.use = `node engine/cli.mjs new DIR --playbook ${e.name}  (studio: the playbook command)`;
  } else if (e.kind === 'cast-shape') {
    out.example = { block: 'canvas', props: { cast: { look: 'drawn', objects: [{ id: 'one', shape: e.name, color: 'accent' }], formations: [{ form: 'hero', hero: 'one', at: 0 }] } } };
  } else if (e.kind === 'cast-look') {
    out.example = { block: 'canvas', props: { cast: { look: e.name, objects: [{ id: 'a', shape: 'server', color: 'accent' }, { id: 'b', shape: 'database', color: 'accent2' }, { id: 'c', shape: 'cloud', color: 'surface' }], formations: [{ form: 'line', at: 0, thread: true }] } } };
  } else if (e.kind === 'cast-move') {
    out.example = MOVES[e.name] ?? MOVES[{ row: 'line', column: 'line' }[e.name]];
    out.note = 'Moves go in props.cast.formations, cued with say (a spoken word) or at (seconds); docs/cast.md lists every field.';
  } else if (e.kind === 'mechanism') {
    const m = MECHANISMS.find(x => x[0] === e.name);
    if (m[5]) out.example = m[5];
    if (e.name === 'icons') out.names = ICONS;
  } else if (e.kind === 'treatment' || e.kind === 'direction' || e.kind === 'type' || e.kind === 'palette') {
    const it = items(`${e.kind === 'type' ? 'types' : `${e.kind}s`}`).find(x => x.id === e.name);
    out.item = it;
  }
  return out;
}

/** The whole index as compact Markdown, grouped by kind (docs/library-index.md is this output). */
export function markdown() {
  const kinds = [...new Set(entries().map(e => e.kind))];
  return [
    '# Library index',
    '',
    'Generated by `node engine/cli.mjs find --index`: everything a film can be built from, one line each. Search it with `find "what you want to show"`; `find --id kind:name` prints the exact authoring. The studio agent uses the same index (`clearframe_catalog` topics `find` and `item`).',
    '',
    ...kinds.flatMap(k => [`## ${k}`, '', ...entries().filter(e => e.kind === k).map(e => `- \`${e.name}\` — ${(e.about || e.title).slice(0, 160)}`), '']),
  ].join('\n');
}
