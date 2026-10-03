// A fast read of a storyboard for the things that make films feel like narrated slides:
// sameness, stillness, density, weak hooks and "and then" story chains. Heuristics, not
// taste: it points at where to look; the sheet and a fresh reviewer decide.
import { loadStoryboard } from './project.mjs';
import { computeTiming, tokenize } from './timing.mjs';
import { rules } from '../../fframes/registry.mjs';
import { elementsExtent as extent } from '../../fframes/canvas.mjs';
import { expandPlotProps } from '../../fframes/plots.mjs';
import { createJob } from '../../fframes/job.mjs';
import { sketch, expandArt, sketchPreset } from '../../fframes/sketches.mjs';

/**
 * A beat as it will be drawn: a canvas built from a library sketch is judged on the sketch's
 * elements (its loops, keys and first-frame picture), not on the two-line reference to it.
 */
function asDrawn(b, { width = 1920, height = 1080 } = {}) {
  try {
    if (b.art?.sketch) b = { ...b, art: expandArt(b.art, { width, height }) };
    if (b.block === 'canvas' && b.props?.plot)
      return { ...b, props: expandPlotProps(b.props, { width, height, beatId: b.id }) };
  } catch {
    // createJob below reports invalid references as author-facing errors.
  }
  if (b.block !== 'canvas' || !b.props?.sketch) return b;
  const preset = sketchPreset(width, height);
  try {
    const d = sketch(b.props.sketch, preset, { seed: b.props.seed }),
      words = b.props.sketchText ?? {};
    const retext = list =>
      list.forEach(el => {
        if (el.type === 'text' && words[el.text] != null) el.text = words[el.text];
        if (el.children) retext(el.children);
      });
    retext(d.elements);
    const { sketch: _s, sketchText: _t, ...rest } = b.props;
    return { ...b, props: { ...d, ...rest, elements: [...d.elements, ...(b.props.elements ?? [])] } };
  } catch {
    return b;
  }
}

const FAMILY = new Proxy({}, { get: (_, name) => rules(name).family });
// A canvas that holds only type is a type card (poster type), not a drawing.
const typeCard = b =>
  b.block === 'canvas' && (b.props?.elements ?? []).length > 0 && b.props.elements.every(el => el.type === 'text');
const family = b => (typeCard(b) ? 'type card' : FAMILY[b.block]);
// A shape with the same id in consecutive canvas beats morphs across the cut: a match cut.
const matched = (a, b) => {
  const ids = new Set((a?.props?.elements ?? []).map(el => el.id).filter(Boolean));
  return (b?.props?.elements ?? []).some(el => el.id && ids.has(el.id));
};
const CONNECTOR =
  /\b(but|so|therefore|because|which means|that's why|that is why|yet|instead|until|unless|except|however|then again|this means|the result|meanwhile|now)\b/i;
const GREETING = /^(hi|hello|hey|welcome|in this video|today we|today,? we|let's|let us|have you ever)\b/i;
const FULL_FRAME = b =>
  b.plate ||
  (b.tone && b.tone !== 'none') ||
  (b.block === 'canvas' && !b.props?.title) ||
  b.block === 'kinetic' ||
  b.props?.align === 'center' ||
  (['title', 'statement', 'endcard', 'chapter', 'highlight', 'quote'].includes(b.block) && !b.props?.title);

function onScreenWords(props) {
  let n = 0;
  // A phrase repeated (a marquee, an echo) is read once.
  const seen = new Set();
  const walk = (v, k) => {
    if (
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
      (seen.add(v), (n += v.split(/\s+/).filter(Boolean).length));
    else if (Array.isArray(v)) v.forEach(x => walk(x, k));
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
  };
  walk(props, '');
  return n;
}

// ------------------------------------------------------------------ cinema

const has = (v, re) => re.test(JSON.stringify(v ?? {}));
const DEPTH = /"(z|dolly|focus|depth|tilt)"\s*:/;
const LIFE = /"(loop|keys|along|dolly)"\s*:|"type"\s*:\s*"particles"/;

/**
 * The eight tells of a slideshow (docs/cinema.md), measured from the storyboard. Each tell
 * found costs 12.5 points of 100; the fixes point at the controls that answer it.
 */
export function cinemaScore(sb, beats, timed, transitions) {
  const tells = [];
  const tell = (name, fix) => tells.push({ name, fix });
  const lens = b => ({ ...(sb.lens ?? {}), ...(b.lens ?? {}) });
  const n = beats.length;
  if (n < 3) return { score: 100, tells };
  // 1. Continuity: worlds, morphs by shared id, graphic wipes, or a cut between two moving
  // cameras (cutting on action, the grammar of a montage).
  const travelling = b =>
    b.block === 'canvas' && (b.props?.world || b.props?.viewFrom || b.props?.dolly || b.props?.focus?.keys);
  // A graphic wipe hides a cut rather than carrying anything across it: half credit.
  let carried = 0;
  const ids = b =>
    new Set([...(b.props?.elements ?? []).map(el => el.id), ...(b.props?.chart ? ['chart'] : [])].filter(Boolean));
  const chartIds = b =>
    b.props?.chart ? b.props.chart.values.map(v => `${b.props.chart.id ?? 'chart'}-${v.id ?? v.label}`) : [];
  for (let i = 1; i < n; i++) {
    const [a, b] = [beats[i - 1], beats[i]];
    const before = new Set([...ids(a), ...chartIds(a)]);
    if (
      (b.props?.world && b.props.world === a.props?.world) ||
      [...ids(b), ...chartIds(b)].some(id => id !== 'chart' && before.has(id)) ||
      (travelling(a) && travelling(b))
    )
      carried++;
    else if (['panel', 'iris', 'whip', 'flash', 'dissolve'].includes(transitions[i])) carried += 0.5;
  }
  if (carried < (n - 1) / 4)
    tell(
      'Card per line',
      `only ${carried} of ${n - 1} cuts carry anything across. Make runs of drawings one world, morph a shape into the next scene (same id), or cut on a whip.`,
    );
  // 2. Build, then freeze: what still moves once the scene has landed.
  // A handheld lens alone is not life: a slide that wobbles is still a slide.
  const alive = b =>
    b.plate?.drift ||
    (b.block === 'canvas' && (b.props?.world || b.props?.viewFrom || has(b.props, LIFE))) ||
    has(b.art, LIFE) ||
    (b.camera && b.camera !== 'none' && b.camera?.move !== 'none' && (b.camera?.amount ?? 0.5) >= 0.6) ||
    b.block === 'kinetic';
  const frozen = beats.filter(b => !alive(b)).length;
  if (frozen / n > 0.5)
    tell(
      'Build, then freeze',
      `${frozen} of ${n} scenes stop moving once they land. Give each hold some life: a loop, particles, a dolly or truck, a plate drift, or lens.handheld.`,
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
  if (!deep && !moved)
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
  const lit = beats.some(b => {
    const l = lens(b);
    return l.grade || l.bloom || l.letterbox || l.leak;
  });
  const glow = beats.some(b => has(b.props, /"(glow|shine|spotlight)"/));
  if (!lit && !glow && !sb.texture)
    tell(
      'Screen-flat image',
      'no light, lens or texture. Choose a lens (grade, bloom, letterbox, leak), add grain and a vignette, and light the subject (glow, shine, spotlight).',
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

export function critique(root) {
  const sb = loadStoryboard(root),
    timing = computeTiming(root),
    beats = sb.beats.map(b => asDrawn(b, sb.format)),
    out = [];
  const add = (level, where, message) => out.push({ level, where, message });
  const t = timing.beats;
  // What `check` would refuse comes first: a storyboard that cannot render has no cinema.
  let job;
  try {
    job = createJob(structuredClone(sb), timing, { draft: true });
  } catch (e) {
    job = { errors: [e.message] };
  }
  for (const e of job.errors ?? []) add('error', 'check', e);
  for (const w of job.warnings ?? []) add('warn', 'check', w);
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
  const cues = [first?.props?.land, ...(first?.props?.elements ?? []).map(el => el.say)].filter(
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
  const timed = [first?.props?.elements ?? [], first?.art?.under ?? [], first?.art?.over ?? []]
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
  const lands = onFirstFrame
    ? 0
    : Math.min(
        landed.length ? Math.min(...landed) : Infinity,
        timed.length ? Math.min(...timed) + 0.6 : Infinity,
        firstDur,
      );
  if (lands > 5.5) add('warn', first.id, `The first idea lands ${lands.toFixed(1)} s in. Land it inside 3–5 s.`);
  // Sameness.
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
  // Letterbox bars cover the top and bottom of landscape frames; frame-pixel type must sit inside.
  const { width: W, height: H } = sb.format;
  for (const b of beats.filter(x => x.block === 'canvas' && !x.props?.view)) {
    const aspect = { ...(sb.lens ?? {}), ...(b.lens ?? {}) }.letterbox;
    const bar = aspect && W > H && W / aspect < H ? (H - W / aspect) / 2 : 0;
    if (!bar) continue;
    const hidden = (b.props.elements ?? []).filter(
      el => el.type === 'text' && (el.y - (el.size ?? 48) < bar || el.y > H - bar),
    );
    if (hidden.length)
      add(
        'warn',
        b.id,
        `${hidden.length} text element(s) sit under the letterbox bars (${Math.round(bar)} px top and bottom), e.g. "${String(hidden[0].text).slice(0, 24)}". Move them into the picture.`,
      );
  }
  const drawn = beats.filter(b => b.block === 'canvas' || b.art).length,
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
  const graphic = transitions.filter(x => ['panel', 'iris', 'whip'].includes(x)).length;
  if (beats.length >= 6 && new Set(transitions.slice(1)).size === 1)
    add(
      'idea',
      'film',
      `Every cut is a ${transitions[1]}. Mark the story's turns with a panel, iris or whip; cut within a sequence.`,
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
      words = onScreenWords(b.props ?? {});
    const moving =
      (b.camera !== 'none' && b.camera?.move !== 'none') ||
      b.plate ||
      JSON.stringify(b.props ?? {}).match(/"loop"|"keys"|"along"/);
    if (d > 8 && !moving && b.block !== 'kinetic')
      add('idea', b.id, `Held ${d.toFixed(1)} s with nothing moving. Add a loop, a drift or split it into two beats.`);
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
  const questions = beats.filter(b => /\?\s*$/.test(b.vo ?? '')).length;
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
  // A film look promises depth: a lens over flat drawings reads as a filtered slide.
  const filmLook = beats.some(b => {
    const l = { ...(sb.lens ?? {}), ...(b.lens ?? {}) };
    return l.letterbox || l.grade;
  });
  const drawings = beats.filter(b => b.block === 'canvas');
  if (filmLook && drawings.length && !drawings.some(b => /"(z|depth)"\s*:/.test(JSON.stringify(b.props))))
    add(
      'idea',
      'film',
      'The film has a lens but every drawing is flat. Give places three planes: z on a far layer, the subject and one soft near layer, then let the camera move through them (docs/canvas.md, Depth).',
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
  const cinema = cinemaScore(sb, beats, t, transitions);
  for (const tell of cinema.tells) add('idea', 'cinema', `${tell.name}: ${tell.fix}`);
  const summary = {
    cinema: cinema.score,
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
