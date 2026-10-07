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

// Film-level mechanisms: how a scene can carry an idea beyond one block. Each names its reference.
const MECHANISMS = [
  ['cast', 'Persistent objects that carry a story across cuts: they gather, queue, rank, travel, merge, split, swap one thing for another and hand the frame to the next scene.', 'a process, a flow of requests, a before/after, a journey, anything with actors that change', 'canvas props.cast', 'docs/cast.md',
    { block: 'canvas', props: { cast: { look: 'drawn', objects: [{ id: 'a', shape: 'ticket', color: 'accent' }, { id: 'b', shape: 'person', color: 'surface' }], formations: [{ form: 'line', at: 0 }, { form: 'travel', ids: ['a'], to: 'b', say: 'reaches' }] } } }],
  ['stage', 'A native GPU stage: actors with stable identities, links that follow them, packets, callouts, commit-grounded code, footage, materials, particles and a 2.5D camera.', 'systems that change over time, technical and PR explainers, architecture', 'block stage, or film stages', 'docs/scene-engine.md',
    { block: 'stage', props: { actors: [{ id: 'cli', label: 'CLI', x: 500, y: 540 }, { id: 'api', label: 'API', x: 1400, y: 540 }], links: [{ from: 'cli', to: 'api' }], packets: [{ on: 'cli-api', say: 'sends' }] } }],
  ['code-scene', 'A code change as one scene: a stage holding only code makes the editor the picture, changed lines lighting up on a spoken word; long lines wrap readably on phones.', 'a pull request, a fix, a before/after in code', 'block stage, props.code', 'docs/scene-engine.md',
    { block: 'stage', props: { code: { title: 'parser.mjs', before: 'if (x) return;', after: 'if (x == null) return;', say: 'null' } } }],
  ['diagram', 'A system diagram that lays itself out for the frame: components, ranks and flows, editable by id.', 'architecture, how parts connect, data paths', 'canvas props.diagram', 'docs/system-diagrams.md', null],
  ['world', 'One drawing the camera travels through across several scenes (world + view), so the film moves through a place instead of cutting between slides.', 'a journey, a process in stations, a map, a pull-back to the whole', 'canvas props.world + view', 'docs/canvas.md', null],
  ['tone-handoff', 'An object fills the frame with its colour and the next scene (any block) plays on that colour; emerge brings it back.', 'zooming into a detail, a chart becoming its number, a report becoming its code', 'cast fill / emerge', 'docs/cast.md', null],
  ['art-layer', 'Drawn art under or over any block: an arrow onto a bar, a circle round a word, soft shapes behind a quote.', 'pointing at the part that matters on a chart or card', 'beat art.under / art.over', 'docs/canvas.md', null],
  ['depth-plates', 'Painted depth plates (generated stills split into layers) put the camera inside a place; never carry text or numbers.', 'places, moods, establishing shots', 'canvas plates, layered assets', 'docs/image-direction.md', null],
  ['kinetic', 'Type that follows the voice word by word, with emphasis words larger in an accent face.', 'quotes, hooks, podcast clips, a line that must land', 'block kinetic', 'docs/speech.md', null],
  ['icons', `A bundled icon set (${ICONS.length} Tabler icons) for canvas elements and cast tiles.`, 'a recognisable thing in one glance', 'canvas icon element, cast object icon', 'film/icons.mjs', null],
];

let cache = null, cacheKey = null;
/** Every entry: {id, kind, name, title, about, when, needs, ref}. Rebuilt when the library layers change. */
export function entries() {
  const key = libraryDirs().join('|');
  if (cache && cacheKey === key) return cache;
  const out = [];
  const add = (kind, name, title, about, when, needs, ref) => out.push({ id: `${kind}:${name}`, kind, name, title: clean(title || name), about: clean(about), when: clean(when), needs: clean(needs), ref });
  for (const b of BLOCKS) add('block', b.name, b.name, b.summary, b.category, Object.keys(b.props ?? {}).slice(0, 8).join(', '), `blocks ${b.name}`);
  for (const s of items('sketches')) add('sketch', s.id, s.id, s.summary, s.use, s.layer ? 'background art layer' : 'canvas', `sketch ${s.id}`);
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
    add('stage-element', ids[0].replace(/[^a-z:]+.*$/, '') || ids[0], ids.join(', '), firstSentence(text), text, 'a stage', 'docs/scene-engine.md');
  for (const [name, about, when, needs, ref] of MECHANISMS) add('mechanism', name, name, about, when, needs, ref);
  for (const dir of fs.existsSync(path.join(ROOT, 'examples')) ? fs.readdirSync(path.join(ROOT, 'examples')) : []) {
    const md = read(`examples/${dir}/README.md`);
    if (!md) continue;
    const title = md.match(/^# (.+)$/m)?.[1] ?? dir, para = md.split('\n\n').find(p => p.trim() && !p.startsWith('#')) ?? '';
    add('example', dir, title, firstSentence(para), '', '', `examples/${dir}/README.md`);
  }
  cache = out;
  cacheKey = key;
  return out;
}

// Everyday words people use for what they want, mapped to the words the library uses.
const SYNONYMS = {
  money: 'revenue cost price finance profit payment coin', growth: 'increase rise trend grow up', process: 'flow pipeline steps sequence queue',
  compare: 'versus comparison before after contrast', time: 'timeline history clock deadline latency', people: 'person user customer team',
  data: 'database chart numbers metric records', idea: 'insight bulb inspiration concept', security: 'lock permission privacy', ship: 'delivery truck logistics box',
  bug: 'fix error incident crash', launch: 'reveal product milestone flag', story: 'narrative journey character', calm: 'quiet gentle soft', energetic: 'punchy fast bold kinetic',
  retro: 'pixel print vintage lcd', playful: 'pixel drawn hand fun', premium: 'cinematic gold glass luxury', code: 'pull request commit diff editor',
  explain: 'explainer concept teaching how why', social: 'vertical short clip hook', email: 'envelope message notification', server: 'backend infrastructure service cloud',
  faster: 'speed latency delta before after', slower: 'latency delay wait delta', cheaper: 'cost delta saving', percent: 'stat delta kpi figure', number: 'stat kpi figure',
  results: 'stat kpi delta proof evidence', quarter: 'kpi quarterly update', quarterly: 'kpi quarterly update numbers', numbers: 'stat kpi bars chart', teaser: 'trailer hook reveal', thank: 'story personal human',
};
const words = t => String(t ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
// Words that say nothing about which picture fits.
const STOP = new Set('a an the and or of to in on for with about our your their we it its is are be this that these those how why what show make made video film clip one two seconds minutes some into from at by as so very just'.split(' '));

/**
 * A short, mixed shortlist for what someone wants to make: at most `perKind` from any one kind so
 * a block, a mechanism, a sketch and a playbook can all surface. Each line says what it is and when
 * it fits; detail(id) gives the exact authoring.
 */
export function find(query, { limit = 8, kinds = null, perKind = 3 } = {}) {
  const q = words(query).filter(w => !STOP.has(w) && !/^\d+$/.test(w));
  // A figure in the brief ("40%", "3x") asks for the blocks that show one.
  if (/\d/.test(query)) q.push('number', 'stat', 'delta', 'kpi');
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
export const line = e => `${e.id} — ${e.about || e.title}${e.when && e.when !== e.about ? ` · when: ${e.when.slice(0, 140)}` : ''}`;

/** Exact authoring details for one entry: how to use it, a copyable example where one exists, its reference. */
export async function detail(id) {
  const e = entries().find(x => x.id === id || x.name === id);
  if (!e) throw new Error(`No library entry ${id}. Search with find first.`);
  const out = { id: e.id, title: e.title, about: e.about, when: e.when, needs: e.needs, ref: e.ref };
  if (e.kind === 'block') {
    const b = BLOCKS.find(x => x.name === e.name);
    Object.assign(out, { props: Object.keys(b.props ?? {}), example: { block: b.name, props: b.example } });
  } else if (e.kind === 'sketch') {
    out.example = { block: 'canvas', props: { sketch: e.name } };
    out.note = `node engine/cli.mjs sketch ${e.name} prints the elements to adapt.`;
  } else if (e.kind === 'playbook') {
    const p = items('playbooks').find(x => x.id === e.name);
    out.scenes = p.beats.map(b => `${b.id} (${b.block}${b.props?.sketch ? `: ${b.props.sketch}` : ''})${b.vo ? `: ${clean(b.vo).slice(0, 80)}` : ''}`);
    out.use = `node engine/cli.mjs new DIR --playbook ${e.name}  (studio: the playbook command)`;
  } else if (e.kind === 'cast-shape') {
    out.example = { block: 'canvas', props: { cast: { look: 'drawn', objects: [{ id: 'one', shape: e.name, color: 'accent' }], formations: [{ form: 'hero', hero: 'one', at: 0 }] } } };
  } else if (e.kind === 'cast-look') {
    out.example = { block: 'canvas', props: { cast: { look: e.name, objects: [{ id: 'a', shape: 'server', color: 'accent' }, { id: 'b', shape: 'database', color: 'accent2' }, { id: 'c', shape: 'cloud', color: 'surface' }], formations: [{ form: 'line', at: 0, thread: true }] } } };
  } else if (e.kind === 'cast-move') {
    out.example = { form: e.name, ids: ['a'], say: 'word' };
    out.note = 'Moves go in props.cast.formations; docs/cast.md lists each move\'s fields.';
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
