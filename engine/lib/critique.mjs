// A fast read of a storyboard for the things that make films feel like narrated slides:
// sameness, stillness, density, weak hooks and "and then" story chains. Heuristics, not
// taste: it points at where to look; the sheet and a fresh reviewer decide.
import { loadStoryboard } from './project.mjs';
import { computeTiming, tokenize } from './timing.mjs';
import { rules } from '../../fframes/registry.mjs';

const FAMILY = new Proxy({}, { get: (_, name) => rules(name).family });
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
  const walk = (v, k) => {
    if (
      typeof v === 'string' &&
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
      ].includes(k)
    )
      n += v.split(/\s+/).filter(Boolean).length;
    else if (Array.isArray(v)) v.forEach(x => walk(x, k));
    else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
  };
  walk(props, '');
  return n;
}

/** Rough extent of canvas elements at rest, in frame pixels. */
function extent(elements) {
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
      else if (el.type === 'text' || el.type === 'icon') {
        const size = el.size ?? 48;
        grow(dx + n('x') - size, dy + n('y') - size, dx + n('x') + size * 4, dy + n('y') + size * 0.3);
      } else if (el.type === 'path' && typeof el.d === 'string') {
        const v = el.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        for (let i = 0; i + 1 < v.length; i += 2) grow(dx + v[i], dy + v[i + 1], dx + v[i], dy + v[i + 1]);
      }
    }
  };
  walk(elements);
  return Number.isFinite(l) ? { w: r - l, h: b - t } : null;
}

export function critique(root) {
  const sb = loadStoryboard(root),
    timing = computeTiming(root),
    beats = sb.beats,
    out = [];
  const add = (level, where, message) => out.push({ level, where, message });
  const t = timing.beats;
  // Hook.
  const first = beats[0],
    firstDur = t[0]?.dur ?? 0;
  if (first?.vo && GREETING.test(first.vo.trim()))
    add(
      'warn',
      first.id,
      'Opens with a greeting or preamble. Lead with the claim, number or question; greet later or never.',
    );
  if (firstDur > 6) add('warn', first.id, `The hook runs ${firstDur.toFixed(1)} s. Land the first idea inside 3–5 s.`);
  // Sameness.
  let run = 1;
  for (let i = 1; i < beats.length; i++) {
    // A world is one continuous picture on purpose; the camera move is the change.
    const world = beats[i].props?.world && beats[i].props.world === beats[i - 1].props?.world;
    run =
      FAMILY[beats[i].block] === FAMILY[beats[i - 1].block] && !beats[i].plate && !beats[i].tone && !world
        ? run + 1
        : 1;
    if (run === 3)
      add(
        'warn',
        `${beats[i - 2].id}…${beats[i].id}`,
        `Three ${FAMILY[beats[i].block]} scenes in a row. Change the picture: a drawing, a plate, a colour block, poster type.`,
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
  for (const b of beats.filter(x => x.block === 'canvas' && x.props?.view == null)) {
    const box = extent(b.props.elements ?? []);
    if (box && (box.w * box.h) / area < 0.18)
      add(
        'idea',
        b.id,
        `The drawing covers ${Math.round((100 * box.w * box.h) / area)}% of the frame. Set view: "auto" to fit it to the space, or draw it larger.`,
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
    if (run.every(b => b.block === 'canvas' && !b.props?.world) && beats[i + 1]?.block !== 'canvas')
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
  // Voice.
  const styled = beats.filter(b => b.style).length;
  if (beats.filter(b => b.vo).length >= 6 && !styled && sb.voice.takes !== 'chapter')
    add(
      'idea',
      'voice',
      'One constant delivery for every line. Record chapters as continuous takes (voice.takes: "chapter") and give the hook, the turn and the payoff their own short style.',
    );
  const summary = {
    beats: beats.length,
    seconds: +timing.duration.toFixed(1),
    families: [...new Set(beats.map(b => FAMILY[b.block]))].length,
    drawn,
    imaged,
    graphicTransitions: graphic,
    tones,
    warnings: out.filter(x => x.level === 'warn').length,
    ideas: out.filter(x => x.level === 'idea').length,
  };
  return { summary, findings: out };
}
