// A fast read of a storyboard for the things that make films feel like narrated slides:
// sameness, stillness, density, weak hooks and "and then" story chains. Heuristics, not
// taste: it points at where to look; the sheet and a fresh reviewer decide.
import { loadStoryboard } from './project.mjs';
import { computeTiming, tokenize } from './timing.mjs';
import { rules } from '../../fframes/registry.mjs';
import { elementsExtent as extent } from '../../fframes/canvas.mjs';

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
  const lands = landed.length ? Math.min(...landed) : firstDur;
  if (lands > 5.5) add('warn', first.id, `The first idea lands ${lands.toFixed(1)} s in. Land it inside 3–5 s.`);
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
