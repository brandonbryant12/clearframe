// A fast read of a storyboard for the things that make films feel like narrated slides:
// sameness, stillness, density, weak hooks and "and then" story chains. Heuristics, not
// taste: it points at where to look; the sheet and a fresh reviewer decide.
import { loadStoryboard } from './project.mjs';
import { computeTiming, tokenize } from './timing.mjs';
import { rules } from '../../film/registry.mjs';
import { palette } from '../../film/catalog.mjs';
import { elementsExtent as extent } from '../../film/canvas.mjs';
import { expandPlotProps } from '../../film/plots.mjs';
import { expandBarsProps } from '../../film/bars.mjs';
import { expandBridgeProps } from '../../film/bridge.mjs';
import { expandCastProps } from '../../film/cast.mjs';
import { expandStatProps } from '../../film/stat.mjs';
import { expandHistogramProps } from '../../film/histogram.mjs';
import { expandMultiplesProps } from '../../film/multiples.mjs';
import { createJob, steadyFilm } from '../../film/job.mjs';
import { roughStandIns } from '../../film/prepare.mjs';
import { sketch, expandArt, sketchPreset, sketchMoments, sketchWords, sketchByName } from '../../film/sketches.mjs';
import { diagramElements } from '../../film/system-diagrams.mjs';
import { sourceNumbers, unsourcedFigures, authoredFigures } from './figures.mjs';
import { pictureFor } from './pictures.mjs';

// A cast's objects declared in an earlier beat carry forward into the beats that follow.
let castCarry = {};
/**
 * A beat as it will be drawn: a canvas built from a library sketch is judged on the sketch's
 * elements (its loops, keys and first-frame picture), not on the two-line reference to it.
 */
function asDrawn(b, { width = 1920, height = 1080 } = {}) {
  try {
    if (b.art?.sketch) b = { ...b, art: expandArt(b.art, { width, height }) };
    if (b.block === 'canvas' && b.props?.plot)
      return { ...b, props: expandPlotProps(b.props, { width, height, beatId: b.id }) };
    if (b.block === 'canvas' && b.props?.bars)
      return { ...b, props: expandBarsProps(b.props, { width, height, beatId: b.id }) };
    if (b.block === 'canvas' && b.props?.cast)
      return { ...b, _cast: true, props: expandCastProps(b.props, { width, height, beatId: b.id }, { state: castCarry.state, objects: castCarry.objects, threads: castCarry.threads, look: castCarry.look, camera: castCarry.camera, unit: castCarry.unit, carry: castCarry }) };
    if (b.block === 'canvas' && b.props?.bridge)
      return { ...b, props: expandBridgeProps(b.props, { width, height, beatId: b.id }) };
    if (b.block === 'canvas' && b.props?.multiples)
      return { ...b, props: expandMultiplesProps(b.props, { width, height, beatId: b.id }) };
    if (b.block === 'canvas' && b.props?.distribution)
      return { ...b, props: expandHistogramProps(b.props, { width, height, beatId: b.id }) };
    if (b.block === 'canvas' && b.props?.stat)
      return { ...b, props: expandStatProps(b.props, { width, height, beatId: b.id }) };
    // A system diagram is judged on the shapes it compiles to (spoken cues count from 0 here).
    if (b.block === 'canvas' && b.props?.diagram) {
      const { diagram, ...rest } = b.props;
      return { ...b, props: { ...rest, elements: [...diagramElements(diagram, { width, height }), ...(rest.elements ?? [])] } };
    }
  } catch {
    // createJob below reports invalid references as author-facing errors.
  }
  if (b.block !== 'canvas' || !b.props?.sketch) return b;
  const preset = sketchPreset(width, height);
  try {
    const d = sketch(b.props.sketch, preset, { seed: b.props.seed, text: b.props.sketchText, say: b.props.sketchSay, params: b.props.sketchParams });
    const { sketch: _s, sketchText: _t, sketchSay: _y, sketchParams: _p, ...rest } = b.props;
    // The words read are the ones written in (its sketchText and any elements added): a sketch's own
    // chrome ("New message", "Cancel", "Send") is recognised, not read, and must not trip the reading pace.
    const _words = onScreenWords({ text: b.props.sketchText ?? {}, elements: b.props.elements ?? [] });
    return { ...b, _words, props: { ...d, ...rest, elements: [...d.elements, ...(b.props.elements ?? [])] } };
  } catch {
    return b;
  }
}

const FAMILY = new Proxy({}, { get: (_, name) => rules(name).family });
/**
 * Native stages are drawings: a stage block, a beat's own stage layer, or a film stage spanning
 * beats (whose actors keep their identity across the cuts between them). Each beat learns the film
 * stage it belongs to as `_stage`.
 */
export function withStages(sb, beats) {
  const index = new Map(sb.beats.map((b, i) => [b.id, i]));
  for (const st of sb.stages ?? []) {
    const [a, z] = [index.get(st.from), index.get(st.to ?? st.from)];
    if (a == null || z == null) continue;
    for (let i = a; i <= z; i++) beats[i] = { ...beats[i], _stage: st.id, _stageFirst: i === a ? st : null };
  }
  return beats;
}
const staged = b => b.block === 'stage' || b.stage != null || b._stage != null;
const sameStage = (a, b) => a?._stage != null && a._stage === b?._stage;
// Consecutive cast beats are one continuous picture: the same objects carry across the cut.
const sameCast = (a, b) => Boolean(a?._cast && b?._cast);
// A canvas that holds only type is a type card (poster type), not a drawing.
const typeCard = b =>
  b.block === 'canvas' && (b.props?.elements ?? []).length > 0 && b.props.elements.every(el => el.type === 'text');
const family = b => (typeCard(b) ? 'type card' : FAMILY[b.block]);
// A shape with the same id in consecutive canvas beats morphs across the cut: a match cut.
// A system diagram's nodes keep their ids too.
const shapeIds = b => [...(b?.props?.elements ?? []).map(el => el.id), ...(b?.props?.diagram?.nodes ?? []).map(n => `diagram-node-${n.id}`)].filter(Boolean);
const matched = (a, b) => {
  if (sameStage(a, b) || sameCast(a, b)) return true;
  const ids = new Set(shapeIds(a));
  return shapeIds(b).some(id => ids.has(id));
};
const CONNECTOR =
  /\b(but|so|therefore|because|which means|that's why|that is why|yet|instead|until|unless|except|however|then again|this means|the result|meanwhile|now)\b/i;
const GREETING = /^(hi|hello|hey|welcome|in this video|today we|today,? we|let's|let us|have you ever)\b/i;
const FULL_FRAME = b =>
  b.plate ||
  (b.tone && b.tone !== 'none') ||
  (b.block === 'canvas' && !b.props?.title) ||
  (b.block === 'stage' && !b.props?.title) ||
  b.block === 'kinetic' ||
  b.props?.align === 'center' ||
  (['title', 'statement', 'endcard', 'chapter', 'highlight', 'quote'].includes(b.block) && !b.props?.title);

const countWords = t => String(t ?? '').split(/\s+/).filter(w => w && !/^[\d.,:%$-]+$/.test(w)).length;
/** What a viewer reads on a document page: the sections the voice brings into focus, or the
 * title and first section when nothing scrolls. The rest is seen as a page, not read. */
function documentWords(el) {
  const sections = Array.isArray(el.sections) ? el.sections : [];
  const find = to =>
    Number.isInteger(to) ? to : sections.findIndex(sec => `${sec.heading ?? ''} ${sec.text ?? ''}`.toLowerCase().includes(String(to).toLowerCase()));
  const read = new Set((el.scroll ?? []).map(k => find(k.to)).filter(i => i >= 0 && i < sections.length));
  if (!read.size && sections.length) read.add(0);
  // A page that scrolls has left its title behind by the time the reading starts.
  return (el.scroll?.length ? 0 : countWords(el.title)) + [...read].reduce((n, i) => n + countWords(sections[i].heading) + countWords(sections[i].text), 0);
}

function onScreenWords(props) {
  let n = 0;
  // A phrase repeated (a marquee, an echo) is read once.
  const seen = new Set();
  const walk = (v, k) => {
    if (v && typeof v === 'object' && v.type === 'document') n += documentWords(v);
    else if (
      typeof v === 'string' &&
      !seen.has(v) &&
      ![
        'source',
        'file',
        'asset',
        'd',
        'fill',
        'stroke',
        'type',
        'enter',
        'exit',
        'mode',
        'align',
        'font',
        'anchor',
        'icon',
        'name',
        'say',
        'cap',
        'join',
        'blend',
        'view',
        'land',
        'growSay',
        'drawSay',
        'exitSay',
        'emphasis',
        'emphasisStyle',
        'id',
        'gradient',
        'kind',
        'shape',
        'ease',
        'color',
        'world',
        'mode',
      ].includes(k)
    )
      // A bare number (a calendar's days, a tick label, a step's index) is seen, not read.
      (seen.add(v), (n += v.split(/\s+/).filter(w => w && !/^[\d.,:%$-]+$/.test(w)).length));
    else if (Array.isArray(v)) v.forEach(x => walk(x, k));
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
  };
  walk(props, '');
  return n;
}

/**
 * Words a camera rect (`view: [x, y, w, h]`) actually shows: text elements whose position, after
 * their groups' offsets, falls inside the shot. A world drawn once and travelled holds every card's
 * words; a beat reads only the card it frames. Null without a camera rect.
 */
function shotWords(props) {
  const v = props.view;
  if (!Array.isArray(v) || v.length !== 4 || !Array.isArray(props.elements)) return null;
  let n = 0;
  const walk = (list, dx, dy) =>
    (list ?? []).forEach(el => {
      const x = (el.x ?? 0) + dx, y = (el.y ?? 0) + dy;
      if (el.type === 'group') return walk(el.children, x, y);
      if (el.type === 'document' && x < v[0] + v[2] && x + (el.w ?? 0) > v[0] && y < v[1] + v[3] && y + (el.h ?? 0) > v[1]) n += documentWords(el);
      if (el.type === 'text' && typeof el.text === 'string' && x >= v[0] && x <= v[0] + v[2] && y >= v[1] && y <= v[1] + v[3])
        n += el.text.split(/\s+/).filter(w => w && !/^[\d.,:%$-]+$/.test(w)).length;
    });
  walk(props.elements, 0, 0);
  return n;
}

export { pictureFor } from './pictures.mjs';

// ------------------------------------------------------------------ film score

const has = (v, re) => re.test(JSON.stringify(v ?? {}));
const DEPTH = /"(z|dolly|focus|depth|tilt)"\s*:/;
const LIFE = /"(loop|keys|along|dolly|steps)"\s*:|"type"\s*:\s*"particles"/;

/**
 * The eight tells of a slideshow (skills/clearframe-motion), measured from the storyboard. Each tell
 * found costs 12.5 points of 100; the fixes point at the controls that answer it.
 */
export function filmScore(sb, beats, timed, transitions) {
  const tells = [];
  const tell = (name, fix) => tells.push({ name, fix });
  const n = beats.length;
  if (n < 3) return { score: 100, tells };
  // 1. Continuity: worlds, morphs by shared id, graphic wipes, or a cut between two moving
  // cameras (cutting on action, the grammar of a montage).
  const travelling = b =>
    b.block === 'canvas' && (b.props?.world || b.props?.viewFrom || b.props?.dolly || b.props?.focus?.keys);
  // A graphic wipe hides a cut rather than carrying anything across it: half credit.
  let carried = 0;
  // A system diagram's components keep their ids, so a shared node carries across the cut.
  const diagramIds = b => (b.props?.diagram?.nodes ?? []).map(n => `diagram-node-${n.id}`);
  const ids = b =>
    new Set([...(b.props?.elements ?? []).map(el => el.id), ...diagramIds(b), ...(b.props?.chart ? ['chart'] : [])].filter(Boolean));
  const chartIds = b =>
    Array.isArray(b.props?.chart?.values) ? b.props.chart.values.map(v => `${b.props.chart.id ?? 'chart'}-${v?.id ?? v?.label}`) : [];
  for (let i = 1; i < n; i++) {
    const [a, b] = [beats[i - 1], beats[i]];
    const before = new Set([...ids(a), ...chartIds(a)]);
    if (
      (b.props?.world && b.props.world === a.props?.world) ||
      sameStage(a, b) ||
      sameCast(a, b) ||
      [...ids(b), ...chartIds(b)].some(id => id !== 'chart' && before.has(id)) ||
      (travelling(a) && travelling(b))
    )
      carried++;
    else if (transitions[i] === 'panel') carried += 0.5;
  }
  if (carried < (n - 1) / 4)
    tell(
      'Card per line',
      `only ${carried} of ${n - 1} cuts carry anything across. Make runs of drawings one world, keep a cast of the film's objects, or morph a shape into the next scene (same id).`,
    );
  // 2. Build, then freeze: what still moves once the scene has landed.
  const alive = b =>
    b.plate?.drift ||
    (b.block === 'canvas' && (b.props?.world || b.props?.viewFrom || has(b.props, LIFE))) ||
    has(b.art, LIFE) ||
    (b.camera && b.camera !== 'none' && b.camera?.move !== 'none' && (b.camera?.amount ?? 0.5) >= 0.6) ||
    b.block === 'kinetic';
  const steady = steadyFilm(sb);
  const frozen = beats.filter(b => !alive(b)).length;
  if (!steady && frozen / n > 0.5)
    tell(
      'Build, then freeze',
      `${frozen} of ${n} scenes stop moving once they land. Inspect these holds against the brief. For business films, keep reading frames steady; reveal a meaningful change or shorten an accidental hold. Camera shake is not a remedy.`,
    );
  // 3. Headings on every scene.
  // A heading at the bottom is still a heading: a chart with a caption under it reads as a slide.
  const headed = beats.filter(b => b.props?.title && !['title', 'endcard', 'chapter'].includes(b.block)).length;
  if (headed / n > 0.4)
    tell(
      'A heading on every scene',
      `${headed} of ${n} scenes carry a heading. Let the picture and the voice say it: a chart fills the frame and a narration-cued note (chart.note, or a callout cued with say) points at the finding; keep titles for chapters.`,
    );
  // 4. Locked, flat camera.
  const deep = beats.some(b => (b.block === 'canvas' && has(b.props, DEPTH)) || has(b.art, DEPTH));
  const moved = beats.some(
    b => b.props?.viewFrom || b.props?.world || (b.camera && b.camera !== 'none' && b.camera !== 'auto'),
  );
  if (!steady && !deep && !moved)
    tell(
      'Locked, flat camera',
      'no depth and no camera move anywhere. Use z layers with a dolly or focus pull, a world whose camera travels, or a camera move on a revelation.',
    );
  // 5. Small subject, big room: how much of the film is full-frame picture.
  const full = beats.filter(FULL_FRAME).length;
  if (full / n < 0.35)
    tell(
      'Small subject, big room',
      `only ${full} of ${n} scenes use the whole frame. Vary the shot scale: full-bleed type, a plate, a tone, a close camera rect, a canvas without a heading.`,
    );
  // A run of beats in one world is one continuous shot: its cuts are invisible.
  const joined = i => i > 0 && beats[i].props?.world && beats[i].props.world === beats[i - 1].props?.world;
  const shots = [];
  beats.forEach((b, i) =>
    joined(i) ? (shots.at(-1).dur += timed[i]?.dur ?? 0) : shots.push({ b, i, dur: timed[i]?.dur ?? 0 }),
  );
  // 6. Same grammar every beat.
  const kinds = new Set(beats.map(family)).size;
  // A camera travelling through a world between two beats is its own kind of join.
  const cuts = [
    ...shots.slice(1).map(x => (matched(beats[x.i - 1], beats[x.i]) ? 'match' : transitions[x.i])),
    ...beats.map((_, i) => (joined(i) ? 'world' : null)).filter(Boolean),
  ];
  if (cuts.length >= 3 && new Set(cuts).size === 1 && kinds <= Math.max(2, n / 4))
    tell(
      'Same grammar every beat',
      `${kinds} kind${kinds === 1 ? '' : 's'} of scene and one kind of cut. Alternate wide and close, dense and bare, and give the story's turns a different cut.`,
    );
  // 7. Screen-flat image.
  const glow = beats.some(b => has(b.props, /"(glow|shine|spotlight)"/));
  if (!steady && !glow && !sb.texture)
    tell(
      'Screen-flat image',
      'no light or texture. Add a little grain, and light the subject (shine, spotlight) where it matters.',
    );
  // 10. Cards, not shots: type and charts on a plain field, with no place or picture behind.
  const TYPE_CARDS = [
    'title',
    'statement',
    'endcard',
    'chapter',
    'kinetic',
    'quote',
    'stat',
    'kpis',
    'bars',
    'line',
    'waffle',
    'ring',
    'delta',
    'compare',
    'list',
    'checklist',
    'magnitude',
  ];
  const card = b =>
    !b.plate &&
    !b.art?.under?.length &&
    !b.props?.world &&
    !b.props?.plates &&
    (TYPE_CARDS.includes(b.block) ||
      (b.block === 'canvas' && b.props?.chart && !(b.props.elements ?? []).some(el => el.type !== 'text')));
  const cards = beats.filter(card).length;
  if (cards / n >= 0.5)
    tell(
      'Slides with motion',
      `${cards} of ${n} scenes are type or a chart on a plain field. Put the numbers and words in the film's place: a chart in front of the world it describes (art.under), in a world the camera travels, or over a plate.`,
    );
  const last = beats.at(-1);
  if (last && card(last))
    tell(
      'Ends on a card',
      `the film ends on ${last.block === 'endcard' ? 'an end card' : 'a type card'}. End on the picture (the place, the subject, the world changed) with the last line over it.`,
    );
  // 9. The first frame: something to look at before anyone speaks.
  const first = beats[0];
  const shown = el =>
    el.type !== 'particles' &&
    (el.at ?? 1) <= 0.05 &&
    (el.enter === 'none' || el.dur === 0 || (el.at === 0 && el.dur === 0));
  const present = list =>
    (list ?? []).some(el => shown(el) || (el.type === 'group' && (el.at ?? 1) <= 0.05 && present(el.children)));
  const pictured =
    first?.plate ||
    (first?.tone && first.tone !== 'none') ||
    (first?.block === 'canvas' && (present(first.props?.elements) || first.props?.plates)) ||
    (first?.block === 'stage' && (present(first.props?.elements) || present(first.props?.under))) ||
    present(first?.stage?.under) || present(first?._stageFirst?.under) ||
    present(first?.art?.under) ||
    present(first?.art?.over);
  if (first && !pictured)
    tell(
      'Opens on an empty frame',
      `the first frames of ${first.id} show only the background while its picture builds. Put the establishing picture on frame one (elements at 0 with enter "none") and animate only the details in.`,
    );
  // 8. An edit set by the voice alone: every beat speaks and every shot is the same length.
  const durs = shots.map(x => x.dur).filter(d => d > 0);
  const mean = durs.reduce((a, b) => a + b, 0) / Math.max(1, durs.length);
  const spread = Math.sqrt(durs.reduce((a, d) => a + (d - mean) ** 2, 0) / Math.max(1, durs.length)) / (mean || 1);
  if (shots.length >= 4 && beats.every(b => b.vo) && spread < 0.3)
    tell(
      'An edit set by the voice alone',
      'every shot speaks and runs about the same length. Vary the rhythm: quick cuts into a long hold, a silent beat before the payoff, a short button at the end.',
    );
  return { score: Math.max(0, Math.round(100 - 11 * tells.length)), tells };
}

/**
 * The critique, never a bare TypeError: an unexpected shape the checks below did not foresee (a list
 * written as one word) reports the storyboard's own errors, which `createJob` names, and the failure.
 */
export function critique(root) {
  try {
    return critiqueStoryboard(root);
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    const findings = [];
    try {
      const sb = loadStoryboard(root), timing = computeTiming(root);
      const job = createJob(sb, timing, { draft: true });
      for (const x of job.errors ?? []) findings.push({ level: 'error', where: 'check', message: x });
    } catch (x) {
      findings.push({ level: 'error', where: 'check', message: x.message });
    }
    findings.push({ level: 'error', where: 'critique', message: `stopped on a storyboard shape it did not expect (${e.message}); fix the errors above, then run critique again` });
    return { summary: { film: 0, beats: 0, seconds: 0, families: 0, drawn: 0, imaged: 0, graphicTransitions: 0, tones: 0, warnings: 0, ideas: 0, errors: findings.length }, findings };
  }
}

function critiqueStoryboard(root) {
  const sb = loadStoryboard(root),
    timing = computeTiming(root),
    beats = withStages(sb, (castCarry = {}, sb.beats.map(b => asDrawn(b, sb.format)))),
    out = [];
  const add = (level, where, message) => out.push({ level, where, message });
  const t = timing.beats;
  // What `check` would refuse comes first: a storyboard that cannot render has no score.
  let job;
  try {
    // Declared placeholders and unfinished elements are judged as a rough cut shows them, and
    // listed as unmade.
    const ready = roughStandIns(root, structuredClone(sb), structuredClone(timing), { rough: true });
    job = createJob(ready.sb, ready.timing, { draft: true });
    for (const p of ready.placeholders) add('idea', p.beat, `placeholder: ${p.reason}. Fine for a rough cut; author it before the final.`);
    for (const u of ready.unfinished) add('idea', u.beat, `${u.element} is marked unfinished${u.note ? ` (${u.note})` : ''}. Finish it before the final.`);
  } catch (e) {
    job = { errors: [e.message] };
  }
  for (const e of job.errors ?? []) add('error', 'check', e);
  for (const w of job.warnings ?? []) add('warn', 'check', w);
  // Figures the author typed that the source documents never state: usually an invented
  // amount to make a sketch draw money.
  const numbers = sourceNumbers(root);
  if (numbers)
    for (const b of sb.beats) {
      const loose = unsourcedFigures(b, numbers);
      if (loose.length)
        add(
          'warn',
          b.id,
          `${loose.slice(0, 4).map(f => `${f.text}${f.where.startsWith('sketchParams') ? ` (${f.where})` : ''}`).join(', ')} ${loose.length > 1 ? 'are' : 'is'} in no source document (${numbers.files.join(', ')}). Every figure comes from the source: take it out; if it is worked out from the source, say how in the beat's source line ("Benefits guide 2027; 26 × $6"); if it is a made-up example (a sample receipt), label it once on screen ("Example").`,
        );
    }
  // With no source document nothing can be checked: a round-14 enrollment film made with `new`
  // narrated a $3,000 the brief never states.
  if (!numbers) {
    const shown = sb.beats.flatMap(b => authoredFigures(b).map(f => f.text));
    if (shown.length >= 2)
      add('warn', 'film', `${shown.length} figures on screen (${[...new Set(shown)].slice(0, 4).join(', ')}…) and no source document to check them against: put the document they come from in source/ (\`start DIR --document FILE\` does it), so critique can name any figure it never states.`);
  }
  // A warning in the brand's own colour: meridian's accent and its warning red are one red, so a
  // phishing film's marks read as decoration (a round-18 Opus film); meadow's accent is its positive.
  try {
    const pal = typeof sb.theme === 'string' ? palette(sb.theme) : null;
    const lab = hex => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
      const [x, y, z] = [
        (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047,
        0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
        (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883,
      ].map(v => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const near = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i])) < 12;
    const said = JSON.stringify(sb.beats);
    const warns = /"negative"/.test(said) || /"sketch":"inspect"/.test(said.replace(/\s/g, ''));
    for (const [role, used] of [['negative', warns], ['positive', /"positive"/.test(said)]])
      if (pal && used && /^#[0-9a-f]{6}$/i.test(pal.accent) && /^#[0-9a-f]{6}$/i.test(pal[role]) && near(pal.accent, pal[role]))
        add('warn', 'film', `In the ${sb.theme} palette the accent and the ${role} colour are the same ${pal.accent} / ${pal[role]}, so ${role === 'negative' ? 'warning marks read as the brand colour' : 'what is good reads as the brand colour'}. Choose a palette that tells them apart (briefing for security and policy films), or mark them in another colour.`);
  } catch {}
  // A trailer's punctuation in a calm film: a flat field of the accent colour sweeping over the
  // picture reads as a rendering fault (a round-18 phishing film's reviewer took it for a bug).
  if (sb.treatment === 'workplace')
    for (const b of sb.beats)
      if (b.transition === 'panel')
        add('warn', b.id, `transition "panel" covers the picture with a flat slab of colour (reviewers read it as a rendering fault in a workplace film): cut, fade, "push" at a chapter, or move the camera within one world.`);
  // "Portrait" is read as "vertical": two onboarding films for a phone app came out 4:5.
  if (sb.format?.preset === 'portrait')
    add('warn', 'film', 'The format is portrait: 4:5 (1080×1350), a feed post. A film for a phone screen (an app, Reels, Stories, TikTok, "vertical") is format.preset "vertical": 9:16 (1080×1920).');
  // Hook.
  const first = beats[0],
    firstDur = t[0]?.dur ?? 0;
  if (first?.vo && GREETING.test(first.vo.trim()))
    add(
      'warn',
      first.id,
      'Opens with a greeting or preamble. Lead with the claim, number or question; greet later or never.',
    );
  // What matters is when the first idea lands: a cued number or drawing, else the scene's end.
  // Explanation primitives (film/explain.mjs) cue their moves inside the prop: {show|draw|fill|flow: {say|at}}.
  const moves = ['graph', 'accumulate', 'estimate', 'field']
    .flatMap(k => Object.values(first?.props?.[k] ?? {}))
    .filter(v => v && typeof v === 'object' && !Array.isArray(v));
  const cues = [first?.props?.land, ...(first?.props?.elements ?? []).map(el => el.say), ...moves.map(v => v.say)].filter(
    c => typeof c === 'string',
  );
  const words = t[0]?.vo?.words ?? [];
  const landed = cues
    .map(c =>
      words.find(
        w =>
          w.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') ===
          c
            .toLowerCase()
            .split(/\s+/)[0]
            .replace(/[^\p{L}\p{N}]/gu, ''),
      ),
    )
    .filter(Boolean)
    .map(w => w.t0 - (t[0]?.start ?? 0));
  // Elements with a timed entrance land at their time.
  const timed = [first?.props?.elements ?? [], first?.art?.under ?? [], first?.art?.over ?? [], moves]
    .flat()
    .map(el => el.at)
    .filter(Number.isFinite);
  // A picture already on the first frame (a plate, a world drawn at 0) is the first idea.
  const onFirstFrame =
    first?.plate ||
    first?.props?.plates ||
    [first?.props?.elements ?? [], first?.art?.under ?? []]
      .flat()
      .some(el => (el.at ?? 1) <= 0.05 && el.type !== 'particles');
  // Speech-following type lands as it is said: its first emphasised word, else just after the voice starts.
  if (first?.block === 'kinetic' && words.length) {
    const norm = w => String(w).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const stress = new Set([].concat(first.props?.emphasis ?? []).map(String).map(norm));
    const hit = words.find(w => stress.has(norm(w.w)));
    landed.push((hit ? hit.t1 : words[0].t0 + 1) - (t[0]?.start ?? 0));
  }
  const lands = onFirstFrame
    ? 0
    : Math.min(
        landed.length ? Math.min(...landed) : Infinity,
        timed.length ? Math.min(...timed) + 0.6 : Infinity,
        firstDur,
      );
  if (lands > 5.5) add('warn', first.id, `The first idea lands ${lands.toFixed(1)} s in. Land it inside 3–5 s.`);
  // Sameness. Drawings are told apart by what they draw (a sketch's name, a cast, a chart's kind):
  // three different workplace pictures in a row are a sequence, not a slide run, and the old rule
  // pushed agents to swap a picture for kinetic type to break it up.
  const pictureOf = i => {
    const p = sb.beats[i]?.props ?? {};
    return p.sketch ?? (p.cast ? 'cast' : p.chart ? `chart-${p.chart.kind}` : null);
  };
  let run = 1;
  for (let i = 1; i < beats.length; i++) {
    // A world is one continuous picture on purpose; the camera move is the change.
    const world = beats[i].props?.world && beats[i].props.world === beats[i - 1].props?.world;
    // Drawings with their own camera (a dolly, a truck) are different shots, as in a montage.
    const shot = b => b.block === 'canvas' && (b.props?.dolly || b.props?.viewFrom);
    run =
      family(beats[i]) === family(beats[i - 1]) &&
      !beats[i].plate &&
      !beats[i].tone &&
      !world &&
      !shot(beats[i]) &&
      !matched(beats[i - 1], beats[i]) &&
      !(pictureOf(i) && pictureOf(i - 1) && pictureOf(i) !== pictureOf(i - 1)) &&
      beats[i].vo
        ? run + 1
        : 1;
    if (run === 3)
      add(
        'warn',
        `${beats[i - 2].id}…${beats[i].id}`,
        `Three ${family(beats[i])} scenes in a row. Change the picture: a drawing, a plate, a colour block, poster type.`,
      );
  }
  const headered = beats.filter(b => b.props?.title && !FULL_FRAME(b)).length;
  if (beats.length >= 5 && headered / beats.length > 0.6)
    add(
      'warn',
      'film',
      `${headered} of ${beats.length} scenes are a heading over a graphic. That is the slide-deck look: give some scenes the whole frame (align center, tone, plate, kinetic stack, canvas).`,
    );
  // A drawing that occupies a small part of the frame reads as an icon on a slide.
  const area = sb.format.width * sb.format.height;
  // (A silent beat with one small mark is a deliberate pause, not an icon on a slide.)
  for (const b of beats.filter(x => x.block === 'canvas' && x.props?.view == null && x.vo && !typeCard(x))) {
    const box = extent(b.props.elements ?? []);
    if (box && (box.w * box.h) / area < 0.18)
      add(
        'idea',
        b.id,
        `The drawing covers ${Math.round((100 * box.w * box.h) / area)}% of the frame. Set view: "auto" to fit it to the space, or draw it larger.`,
      );
  }
  // A mosaic needs room for its tiles: a shape a few tiles across reads as noise.
  for (const b of beats.filter(x => x.block === 'canvas')) {
    const small = [];
    const visit = list =>
      (list ?? []).forEach(el => {
        if (el.type === 'group') return visit(el.children);
        const m = el.mosaic ?? b.props.mosaic;
        if (!m || m === false || !['rect', 'circle', 'ellipse', 'poly', 'path'].includes(el.type)) return;
        if (el.fill == null || el.fill === 'none') return;
        const e = extent([el]),
          tile = (m === true ? null : m.tile) ?? 16;
        // A shape needs enough tiles to read as a mosaic: ~25 in all, and at least two deep.
        if (e && ((e.w * e.h) / (tile * tile) < 25 || Math.min(e.w, e.h) / tile < 2)) small.push(el.id ?? el.type);
      });
    visit(b.props?.elements);
    if (small.length)
      add(
        'idea',
        b.id,
        `${small.length} mosaic shape(s) have too few tiles to read (${small.slice(0, 3).join(', ')}). Draw them bigger or use a smaller tile.`,
      );
  }
  // Frame-pixel drawings that reach the source line sit on top of the attribution.
  const sourceTop = sb.format.height - (sb.frame ? 165 : 130);
  for (const b of beats.filter(x => x.block === 'canvas' && x.props?.source && !x.props.view)) {
    const box = extent((b.props.elements ?? []).filter(el => (el.w ?? 0) < sb.format.width));
    if (box && box.bottom > sourceTop)
      add(
        'warn',
        b.id,
        `The drawing reaches y ${Math.round(box.bottom)}, into the source line (from y ${sourceTop}). Move it up or set view: "auto".`,
      );
  }
  // A lower-third title shares the bottom of the frame with frame-pixel drawings.
  for (const b of beats.filter(x => x.block === 'canvas' && (x.heading ?? sb.heading) === 'bottom' && x.props?.title)) {
    const box = !b.props.view && extent(b.props.elements ?? []);
    if (box && box.bottom > sb.format.height - 340)
      add(
        'warn',
        b.id,
        `heading: bottom puts the title where this drawing reaches (y ${Math.round(box.bottom)}). Set view: "auto" so the drawing fits above it, or keep the heading at the top.`,
      );
  }
  const drawn = beats.filter(b => b.block === 'canvas' || b.art || staged(b)).length,
    imaged = beats.filter(b => b.plate || ['image', 'video', 'annotate'].includes(b.block)).length;
  if (timing.duration > 40 && !drawn)
    add(
      'idea',
      'film',
      'Nothing is drawn. Where the narration explains how or why, draw it (canvas; start from clearframe sketch).',
    );
  if (timing.duration > 40 && !imaged && !drawn)
    add(
      'idea',
      'film',
      'No imagery at all. A plate (photo or generated still with a duotone treatment) grounds a film in the world.',
    );
  // Consecutive drawings that cut from one to the next could be one world the camera travels.
  for (let i = 2; i < beats.length; i++) {
    const run = beats.slice(i - 2, i + 1);
    if (
      run.every(b => b.block === 'canvas' && !b.props?.world && !b.props?.dolly && !b.props?.viewFrom && b.vo) &&
      !run.some((b, j) => j && matched(run[j - 1], b)) &&
      beats[i + 1]?.block !== 'canvas'
    )
      add(
        'idea',
        run[0].id,
        `${run.map(b => b.id).join(', ')} are separate drawings in a row. If they are stops on one journey, process or map, make them one world (props.world + camera view) so the camera travels instead of cutting.`,
      );
  }
  // Transitions.
  const transitions = beats.map(b => b.transition ?? sb.transition ?? 'fade');
  const graphic = transitions.filter(x => x === 'panel').length;
  if (beats.length >= 6 && new Set(transitions.slice(1)).size === 1)
    add(
      'idea',
      'film',
      `Every cut is a ${transitions[1]}. Mark the story's turns with a push or a camera move through one world; cut within a sequence.`,
    );
  if (graphic > Math.max(2, beats.length / 3))
    add(
      'warn',
      'film',
      `${graphic} graphic transitions in ${beats.length} scenes. Reserve them for turns, or they stop meaning anything.`,
    );
  const tones = beats.filter(b => b.tone && b.tone !== 'none').length;
  if (tones > Math.max(2, beats.length / 4))
    add('warn', 'film', `${tones} colour-blocked scenes. Punctuation works when it is rare.`);
  // Stillness and density.
  beats.forEach((b, i) => {
    const d = t[i]?.dur ?? 0,
      words = b._words ?? shotWords(b.props ?? {}) ?? onScreenWords(b.props ?? {});
    const moving =
      (b.camera !== 'none' && b.camera?.move !== 'none') ||
      b.plate ||
      JSON.stringify(b.props ?? {}).match(/"loop"|"keys"|"along"|"steps"/);
    if (d > 8 && !moving && b.block !== 'kinetic')
      add('idea', b.id, `Held ${d.toFixed(1)} s with nothing moving. Inspect the reading hold; shorten it or reveal the next meaningful change if it feels stalled. Do not add camera shake.`);
    // Length reached by talking longer over the same picture (round 16: five beats of 10–14 s, a closing
    // "0" held for 12 s). Two or more sentences over one picture this long are two beats.
    const sentences = String(b.vo ?? '').split(/(?<=[.!?])\s+/).filter(x => /\w/.test(x)).length;
    // A picture with a moment per sentence (sketch moments, cued chart values, cued elements) keeps up.
    const written = sb.beats.find(x => x.id === b.id)?.props ?? {};
    const moments =
      Object.keys(written.sketchSay ?? {}).length +
      (written.chart?.values ?? []).filter(v => v?.say).length +
      (JSON.stringify(written.elements ?? []).match(/"say":/g) ?? []).length;
    if (d > 9.5 && sentences >= 2 && moments < sentences && b.pace !== 'hold' && b.block !== 'kinetic' && !b.props?.cast && !staged(b))
      add('warn', b.id, `${d.toFixed(1)} s and ${sentences} sentences on one picture: a viewer has seen it all long before the voice is done. Split the line into beats, each with its own picture (a longer film needs more pictures, not more words over one).`);
    // The source line is read by people: a storyboard source id ("q2-phishing") is a slug, not
    // an attribution.
    const shown = String(sb.beats[i]?.props?.source ?? '');
    const ids = new Set((sb.sources ?? []).map(x => x.id).filter(Boolean));
    if (shown && /(^|[\s(/])[\w.-]+\.(mjs|js|json|wav|txt)\b/.test(shown))
      add('warn', b.id, `The source line shows "${shown}", a file path, not an attribution. Name who said it or the document people would recognise ("Sam, on air"; "Kestrel Benefits Guide 2027").`);
    else if (shown && shown.split(/\s*[,;·]\s*/).every(part => ids.has(part.trim()) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(part.trim())))
      add('warn', b.id, `The source line shows "${shown}", an id, not an attribution. Write what people read: the document and its date ("Alder Street Q2 2027 phishing simulation report").`);
    // Type standing in for a picture: say which fill-in-the-blank picture fits its words.
    const authoredBeat = sb.beats[i];
    if (['kinetic', 'statement', 'callout', 'list', 'checklist'].includes(authoredBeat?.block) && !authoredBeat.plate) {
      const fit = pictureFor(authoredBeat.vo ?? '');
      if (fit)
        add(
          'idea',
          b.id,
          fit.sketch
            ? `${fit.why}: the \`${fit.sketch}\` sketch shows that (node engine/cli.mjs sketch ${fit.sketch} prints the beat to paste). Words on their own read as a slide.`
            : `${fit.why}: show it with ${fit.use}. Words on their own read as a slide.`,
        );
    }
    // A sketch whose moments are only partly landed on words: the rest keep their default
    // seconds and can land before the ones that were moved.
    const authored = sb.beats[i]?.props;
    if (authored?.sketch && authored.sketchSay && Object.keys(authored.sketchSay).length) {
      const left = sketchMoments(authored.sketch, authored.sketchParams).filter(m => !(m in authored.sketchSay));
      if (left.length)
        add(
          'warn',
          b.id,
          `sketchSay lands ${Object.keys(authored.sketchSay).join(', ')} on words but not ${left.join(', ')}: those keep their default seconds and can land out of order. Give every moment a word.`,
        );
      // Moments happen in a fixed order (coins before their total, the bar before its split): words
      // given out of that order make a sketch run backwards.
      const free = sketchByName(authored.sketch)?.freeMoments ?? [],
        order = sketchMoments(authored.sketch, authored.sketchParams).filter(m => !free.includes(m)),
        spoken = String(sb.beats[i]?.vo ?? '').toLowerCase(),
        heard = order.filter(m => m in authored.sketchSay).map(m => ({ m, w: authored.sketchSay[m], at: spoken.search(new RegExp(`\\b${String(authored.sketchSay[m]).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)) }));
      const late = heard.findIndex((h, k) => k > 0 && h.at >= 0 && heard[k - 1].at > h.at);
      if (late > 0)
        add(
          'warn',
          b.id,
          `sketchSay puts ${heard[late].m} on "${heard[late].w}", which is said before "${heard[late - 1].w}" (${heard[late - 1].m}), but ${authored.sketch} shows ${heard[late - 1].m} first: give its moments words in this order: ${order.join(', ')}.`,
        );
    }
    // Placeholder words left in a filled sketch draw as themselves ("STEP4" on screen), usually
    // because sketchParams added a step after sketchText was written.
    if (authored?.sketch && sketchByName(authored.sketch)?.keep) {
      const filled = authored.sketchText ?? {};
      const words = sketchWords(authored.sketch, authored.sketchParams),
        left = words.filter(w => !(w in filled)),
        stray = Object.keys(filled).filter(k => !words.includes(k) && !(sketchByName(authored.sketch)?.keepText ?? []).includes(k));
      if (left.length)
        add('warn', b.id, `${Object.keys(filled).length ? `sketchText fills ${Object.keys(filled).filter(k => words.includes(k)).join(', ') || 'nothing it draws'} but not` : 'No sketchText: the sketch draws'} ${left.join(', ')}: ${left.length > 1 ? 'those draw' : 'it draws'} on screen as the placeholder word. Fill every one, or change sketchParams so the sketch draws fewer.`);
      const moments = new Set(sketchMoments(authored.sketch, authored.sketchParams)),
        cued = stray.filter(k => moments.has(k)), other = stray.filter(k => !moments.has(k));
      if (cued.length)
        add('warn', b.id, `sketchText names ${cued.join(', ')}, which ${cued.length > 1 ? 'are moments' : 'is a moment'}: put the spoken word in sketchSay ({"${cued[0]}": "a word from the narration"}) so the picture moves on it.`);
      if (other.length)
        add('warn', b.id, `sketchText names ${other.join(', ')}, which ${authored.sketch} does not draw with these sketchParams (its words are ${words.join(', ')}): misspelt, or a step the params removed.`);
    }
    // A hold on a slice of an imported recording plays silence in the middle of the conversation.
    if (sb.beats[i]?.hold && t[i]?.vo?.provider === 'imported' && i < t.length - 1 && t[i + 1]?.vo?.provider === 'imported')
      add('warn', b.id, `hold adds ${sb.beats[i].hold} s of silence inside the recording, between two things said. Let the picture move instead (a cue on a later word), or put the hold on the last beat.`);
    // Speech-following type that changes faster than anyone reads: one word at a time, or
    // two-word groups, across a whole passage. Fine for a few seconds of emphasis.
    if (b.block === 'kinetic' && d > 5) {
      const mode = b.props?.mode ?? 'highlight',
        group = mode === 'word' ? 1 : (b.props?.maxWords ?? 6),
        spoken = String(b.vo ?? '').split(/\s+/).filter(Boolean).length,
        each = spoken ? (d * Math.min(group, spoken)) / spoken : d;
      if (each < 0.9)
        add(
          'warn',
          b.id,
          `${mode === 'word' ? 'One word at a time' : `${group}-word phrases`} for ${d.toFixed(1)} s: the type changes every ${each.toFixed(1)} s, faster than a viewer reads. Keep that for a few seconds of emphasis; for a passage use mode "highlight" with maxWords 6–8 (a stable phrase that lights up as it is spoken), or give the passage a picture and let captions carry the words.`,
        );
    }
    if (d > 0 && words / d > 3.2 && b.block !== 'kinetic')
      add(
        'warn',
        b.id,
        `${words} words on screen for ${d.toFixed(1)} s (${(words / d).toFixed(1)}/s). Viewers read ~3 words a second while listening; cut the text or extend the beat.`,
      );
    if (b.vo && tokenize(b.vo).length > 40)
      add('warn', b.id, 'More than 40 spoken words in one beat. Split it: one idea per beat.');
    if (
      ['stat', 'kpis', 'delta', 'bars', 'line'].includes(b.block) &&
      b.vo &&
      !b.props?.land &&
      !b.props?.growSay &&
      !b.props?.drawSay
    )
      add(
        'idea',
        b.id,
        'The number is not cued to a word. Set land/growSay to the stressed word so the picture lands with the voice.',
      );
  });
  // Story links: "and then" chains.
  let chain = [];
  for (const b of beats.filter(x => x.vo)) {
    if (CONNECTOR.test(b.vo)) chain = [];
    else chain.push(b.id);
    if (chain.length === 4)
      add(
        'idea',
        `${chain[0]}…${chain[3]}`,
        'Four beats in a row without a but/so/because. Link beats causally (but… therefore…) or the film becomes a list.',
      );
  }
  // A question opens a loop wherever it falls in the line ("Why did…? The audit flagged it.").
  const questions = beats.filter(b => /\?(\s|$)/.test(b.vo ?? '')).length;
  if (timing.duration > 45 && !questions)
    add(
      'idea',
      'film',
      'No question is ever asked. Open a loop early (a question, a mystery, a flash-forward) and close it at the peak.',
    );
  // Voice. Gemini TTS keeps one consistent voice when the film is one continuous take read
  // with one short style; per-line styles, long director's notes and stitched takes drift.
  const narrated = beats.filter(b => b.vo);
  const takes = sb.voice.takes ?? 'film';
  if (narrated.length >= 4 && takes === 'beat')
    add(
      'idea',
      'voice',
      'Each line is recorded separately, so the voice can change between beats. Record the film as one continuous take (voice.takes: "film", the default).',
    );
  const styled = narrated.filter(b => b.style);
  if (styled.length && takes !== 'beat' && !sb.voice.perBeatStyle)
    add(
      'idea',
      'voice',
      `${styled.length} beat(s) set their own style; the continuous take uses voice.style for every line. Shape delivery with the words: short sentences for punch, a question for lift, punctuation and <short pause> for timing.`,
    );
  const styleWords = String(sb.voice.style ?? '')
    .split(/\s+/)
    .filter(Boolean).length;
  if (styleWords > 10)
    add(
      'warn',
      'voice',
      `voice.style is ${styleWords} words. Long direction makes the voice drift; keep it to 2–6 words ("warm, curious, unhurried") and choose (or design) a voice for character.`,
    );
  const spoken = narrated.reduce((n, b) => n + b.vo.split(/\s+/).length, 0);
  const tags = narrated.reduce((n, b) => n + (b.vo.match(/<[^>]+>/g) ?? []).length, 0);
  if (tags > Math.max(2, spoken / 30))
    add(
      'idea',
      'voice',
      `${tags} inline tags in ${spoken} words. Tags are seasoning: a pause or breath at a turn, one laugh in a conversation. Let punctuation carry the rest.`,
    );
  const directions = narrated.filter(b =>
    /\([^)]*(?:whisper|slow|pause|laugh|sigh|softly|excited)[^)]*\)|\[[^\]]+\]/i.test(b.vo),
  );
  if (directions.length)
    add(
      'warn',
      directions[0].id,
      'Stage directions in the narration text will be read aloud. Use an inline tag (<short pause>, <breath>) or the voice style instead.',
    );
  // One dataset per film: the same label must show the same value (and unit) everywhere.
  const shown = new Map();
  const record = (label, value, unit, id) => {
    if (typeof label !== 'string' || !Number.isFinite(value)) return;
    const key = label.trim().toLowerCase();
    const seen = shown.get(key) ?? [];
    seen.push({ label, value, unit: unit ?? '', id });
    shown.set(key, seen);
  };
  for (const b of beats) {
    const p = b.props ?? {};
    for (const v of p.chart?.values ?? []) record(v.label, v.value, p.chart.suffix ?? p.chart.prefix, b.id);
    for (const v of Array.isArray(p.data) ? p.data : []) record(v.label, v.value, p.format ?? p.suffix, b.id);
    for (const v of Array.isArray(p.items) ? p.items : []) record(v.label, v.value, p.format ?? v.suffix, b.id);
    if (Number.isFinite(p.value)) record(p.label, p.value, p.suffix, b.id);
  }
  for (const seen of shown.values()) {
    const distinct = [...new Map(seen.map(x => [`${x.value}${x.unit}`, x])).values()];
    if (distinct.length > 1)
      add(
        'warn',
        distinct.map(x => x.id).join('…'),
        `"${seen[0].label}" shows ${distinct.map(x => `${x.value}${x.unit} in ${x.id}`).join(' and ')}. One label, one value: the viewer reads a contradiction. Rename the label if these are different measures.`,
      );
  }
  const film = filmScore(sb, beats, t, transitions);
  for (const tell of film.tells) add('idea', 'film', `${tell.name}: ${tell.fix}`);
  const summary = {
    film: film.score,
    beats: beats.length,
    seconds: +timing.duration.toFixed(1),
    families: [...new Set(beats.map(family))].length,
    drawn,
    imaged,
    graphicTransitions: graphic,
    tones,
    warnings: out.filter(x => x.level === 'warn').length,
    ideas: out.filter(x => x.level === 'idea').length,
  };
  return { summary, findings: out };
}
