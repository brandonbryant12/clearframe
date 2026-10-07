// Storyboard + timing → the native job the renderer draws. Validation, cue resolution and
// scheduling happen here, so every frame the renderer draws is a pure function of the job.
import { CANVASES, FRAME_RATES, MOTIONS, TRANSITIONS, BACKDROPS, normalizeProps, palette } from './catalog.mjs';
import {
  normalizeElements,
  scheduleElements,
  eachElement,
  hasCount,
  hasDigits,
  roughSpec,
  applyRough,
  TREATMENTS,
  elementsExtent,
  reframeView,
} from './canvas.mjs';
import {
  ENTRANCE,
  COVER,
  EXITS,
  TONES,
  PLATE_SIDES,
  DRIFTS,
  CAMERA_MOVES,
  TRANSITION_COLORS,
  TEXT_MOTIONS,
  LENS_GRADES,
  LENS_KEYS,
} from './constants.mjs';
import { glyphCheck } from './glyphs.mjs';
import { typeById } from './library.mjs';
import { voiceOf, voiceFace, DEFAULT_VOICE } from './type.mjs';
import { rules } from './registry.mjs';
import { expandArt } from './sketches.mjs';
import { expandKPIProps } from './kpis.mjs';
import { expandTeachingProps } from './teaching.mjs';
import { expandPlotProps } from './plots.mjs';
import { expandBarsProps } from './bars.mjs';
import { expandBridgeProps, orderBridgeTimes } from './bridge.mjs';
import { expandCastProps } from './cast.mjs';
import { expandStatProps } from './stat.mjs';
import { expandHistogramProps } from './histogram.mjs';
import { expandMultiplesProps } from './multiples.mjs';
import { captionCues, findWord } from '../engine/lib/timing.mjs';

const unit = v => Number.isFinite(v) && v >= 0 && v <= 1;
const validMotion = m => MOTIONS.includes(m.preset) && unit(m.intensity);

/** Check a film or beat `lens`; letterbox false (or 0) removes the bars. */
export function lensSpec(v, where = 'lens') {
  if (v == null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} must be an object`);
  for (const [k, x] of Object.entries(v)) {
    if (!LENS_KEYS.includes(k)) throw new Error(`${where}.${k} is not a lens setting (${LENS_KEYS.join(', ')})`);
    if (k === 'letterbox') {
      if (!(x === false || x === 0 || (Number.isFinite(x) && x >= 1.5 && x <= 3)))
        throw new Error(`${where}.letterbox must be a picture aspect from 1.5 to 3 (2.39 scope, 2, 1.85) or false`);
    } else if (k === 'grade') {
      if (!LENS_GRADES.includes(x)) throw new Error(`${where}.grade must be ${LENS_GRADES.join(', ')}`);
    } else if (!unit(x)) throw new Error(`${where}.${k} must be 0–1`);
  }
  return v;
}

/** Build the job; errors block rendering, warnings are advice (drafts demote some errors). */
export function createJob(sb, timing, { draft = false } = {}) {
  const report = { errors: [], warnings: [], draft };
  const film = filmSettings(sb, timing, report);
  const transitions = timing.beats.map(b => {
    // A film-wide transition never applies to the first frame: the film opens on its picture.
    let t = sb.beats[b.index].transition ?? (b.index === 0 ? 'cut' : (sb.transition ?? 'fade'));
    if (t === 'auto') t = b.index && timing.beats[b.index - 1].chapter !== b.chapter ? 'rise' : 'fade';
    return t;
  });
  const captions = captionCues(timing);
  const beats = [];
  // A cast's objects and where each beat left them, handed to the next beat that names the cast.
  const cast = {};
  for (const b of timing.beats) {
    try {
      beats.push(prepareBeat(b, { sb, timing, film, transitions, captions, report, cast }));
    } catch (e) {
      report.errors.push(`${b.id}: ${e.message}`);
    }
  }
  mirrorExitStyles(beats);
  linkMorphs(beats, sb, timing, report);
  linkCasts(beats, sb, timing, report, cast);
  linkWorlds(beats, sb, timing, report);
  const frame = frameChrome(sb, beats, report);
  fitGraphicTransitions(beats, timing, report);
  filmWarnings(sb, timing, film.theme, report);
  // A beat that failed to prepare is already reported; the timeline gap it leaves is not a second problem.
  if (beats.length === timing.beats.length && (beats.some(b => b.frames < 1) || beats.reduce((n, b) => n + b.frames, 0) !== timing.frames))
    report.errors.push('Every beat must span at least one frame and cover the complete timeline.');
  const job = {
    version: 2,
    title: timing.title,
    width: timing.width,
    height: timing.height,
    fps: timing.fps,
    frames: timing.frames,
    theme: film.theme,
    motion: film.motion,
    backdrop: film.backdrop,
    chrome: sb.chrome === true,
    captions: film.captions,
    caption_style: film.captionStyle,
    ...(film.texture && film.texture !== 'none' ? { texture: film.texture } : {}),
    text_motion: film.textMotion,
    ...(film.type ? { type: film.type } : {}),
    ...(frame ? { frame } : {}),
    beats,
  };
  return { job, errors: report.errors, warnings: report.warnings };
}

// ------------------------------------------------------------------ film

function filmSettings(sb, timing, { errors }) {
  if (!CANVASES.some(([w, h]) => w === timing.width && h === timing.height))
    errors.push('Native canvas must be landscape, vertical, square, portrait, or 640×360.');
  if (!FRAME_RATES.includes(timing.fps)) errors.push(`Native fps must be ${FRAME_RATES.join(', ')}.`);
  const motion = { preset: 'gentle', intensity: 0.65, ...sb.motion };
  if (!validMotion(motion)) errors.push('motion requires a known preset and intensity from 0 to 1.');
  const vertical = timing.height > timing.width;
  if (sb.captions != null && ![true, false, 'auto', 'off', 'pop'].includes(sb.captions))
    errors.push('captions must be true, false, auto, off or pop.');
  const backdrop = sb.backdrop ?? 'none';
  if (!BACKDROPS.includes(backdrop)) errors.push(`Native backdrop must be ${BACKDROPS.join(', ')}.`);
  const texture = sb.texture ?? null;
  const textureOk =
    texture == null ||
    ['grain', 'vignette', 'film', 'none'].includes(texture) ||
    (typeof texture === 'object' &&
      !Array.isArray(texture) &&
      Object.entries(texture).every(([k, v]) =>
        k === 'animate' ? typeof v === 'boolean' : ['grain', 'vignette'].includes(k) && unit(v),
      ));
  if (!textureOk) errors.push('texture must be grain, vignette, film, none or {grain: 0–1, vignette: 0–1, animate}.');
  if (sb.pacing.outro)
    errors.push('Use an endcard beat instead of pacing.outro so every output frame has an authored scene.');
  try {
    lensSpec(sb.lens);
  } catch (e) {
    errors.push(e.message);
  }
  const textMotion = sb.textMotion ?? 'lines';
  if (!TEXT_MOTIONS.includes(textMotion)) errors.push(`textMotion must be ${TEXT_MOTIONS.join(', ')}.`);
  // The type voice: display family and emphasis for titles, statements, chapters, endcards
  // and kinetic text, resolved here so the renderer never reads the library.
  let type = null;
  try {
    type = voiceOf(sb.type, sb.type != null ? typeById(sb.type) : null);
  } catch (e) {
    errors.push(e.message);
  }
  return {
    textMotion,
    type,
    theme: palette(sb.theme ?? 'paper'),
    motion,
    vertical,
    captions: sb.captions === true || sb.captions === 'pop' || ((sb.captions ?? 'auto') === 'auto' && vertical),
    captionStyle: sb.captions === 'pop' ? 'pop' : 'plate',
    backdrop,
    texture,
  };
}

// ------------------------------------------------------------------ one beat

function prepareBeat(b, { sb, timing, film, transitions, captions, report, cast = {} }) {
  if (b.scene)
    throw new Error('JavaScript scenes are retired. Port this beat to a native block; no browser fallback runs.');
  const frame = 1 / timing.fps,
    source = sb.beats[b.index],
    spec = rules(b.block);
  const helperFrame = { width: timing.width, height: timing.height, beatId: b.id, duration: b.dur };
  const castProps = b.block === 'canvas' && b.props?.cast != null
    ? expandCastProps(b.props, helperFrame, { state: cast.state, objects: cast.objects, threads: cast.threads, look: cast.look, camera: cast.camera, unit: cast.unit, heading: b.heading ?? sb.beats[b.index]?.heading ?? sb.heading, cue: cueResolver(b, frame), carry: cast, notes: report.warnings })
    : b.props;
  const authoredProps = b.block === 'canvas'
    ? expandMultiplesProps(expandHistogramProps(expandStatProps(expandBridgeProps(expandBarsProps(expandPlotProps(expandTeachingProps(expandKPIProps(castProps ?? {}, helperFrame), helperFrame), helperFrame), helperFrame), helperFrame), helperFrame), helperFrame), helperFrame)
    : (b.props ?? {});
  const props = normalizeProps(b.block, authoredProps, {
    vertical: film.vertical,
    width: timing.width,
    height: timing.height,
    assets: sb.assets,
    // Spoken cues resolve before a system diagram compiles, so its derived timing is exact.
    resolve: cueResolver(b, frame),
  });
  const motion = { ...film.motion, ...source.motion };
  if (!validMotion(motion)) throw new Error('Invalid beat motion');
  const entrance = ENTRANCE[motion.preset];
  const cue = cueResolver(b, frame);
  const authored = props.land ?? props.growSay ?? props.drawSay;
  // Headlines start almost immediately; data scenes leave a moment for the header. A count
  // cued to a spoken word pre-rolls so the figure lands on the word instead of starting there.
  let at = cue(authored, spec.cueDelay);
  if (spec.preroll && typeof authored === 'string') at = Math.max(0, at - spec.preroll);
  if (props.focus && b.block === 'bars') props.focus.at = cue(props.focus.say, at + 1.6);
  if (props.focus && b.block === 'annotate') props.focus.at = cue(props.focus.say, at + 0.4);
  if (spec.staged) stageItems(props, spec.staged, { b, frame, at, authored, cue, entrance });
  let settle = spec.settle(props, at, entrance, spec);
  // Word, letter and cascade reveals of display type (mirrors pieces() in scenes.rs).
  const textMotion = source.textMotion ?? film.textMotion;
  const display = String(props.text ?? (spec.hero || b.block === 'chapter' ? props.title : '') ?? '');
  if (textMotion !== 'lines' && display.trim()) {
    const letters = textMotion !== 'words',
      n = letters ? display.replace(/\s/g, '').length : display.trim().split(/\s+/).length,
      step = Math.min(letters ? 0.028 : 0.075, 0.9 / Math.max(1, n));
    settle = Math.max(settle, at + (n - 1) * step + entrance);
  }
  // Author-drawn elements: resolve spoken cues and write exact times for the renderer.
  const scheduleArt = (list, start, stagger = 0) => {
    eachElement(list, el => {
      if (
        ['rect', 'circle', 'ellipse'].includes(el.type) &&
        el.stroke != null &&
        el.stroke !== 'none' &&
        el.fill == null
      )
        report.warnings.push(
          `${b.id}: stroked ${el.type}${el.id ? ` "${el.id}"` : ''} has no explicit fill; the native default is solid accent and can hide layers behind it. Set fill: "none" for an outline, or choose an explicit fill colour.`,
        );
    });
    const end = scheduleElements(list, { start, stagger, entrance, resolve: v => cue(v), limit: b.dur });
    eachElement(list, el => {
      if (el.at > b.dur - frame + 1e-7)
        throw new Error(
          `a canvas element is cued at ${el.at.toFixed(2)}s, after the beat ends; extend the beat or move the cue.`,
        );
    });
    return end;
  };
  if (b.block === 'canvas') {
    if ((b.props?.plot != null || b.props?.bars != null || b.props?.bridge != null || b.props?.stat != null || b.props?.distribution != null || b.props?.multiples != null) && !sb.sources.length)
      throw new Error('Quantitative plots need a storyboard.sources entry.');
    settle = Math.max(settle, scheduleArt(props.elements, at, props.stagger ?? 0));
    // A bridge's last total is the payoff: one cued to the final word leaves nothing to read it in.
    if (b.props?.bridge != null) {
      // Each driver floats from the total before it, so columns must arrive in reading order.
      const spec = b.props.bridge, cued = [false, ...spec.steps.map(x => x.say != null), spec.end?.say != null];
      const part = (kind, i) => props.elements.filter(e => new RegExp(`-bridge-${kind}-${i}(-\\d+)?$`).test(e.id ?? ''));
      const times = cued.map((_, i) => part('bar', i)[0]?.at ?? 0), ordered = orderBridgeTimes(times, cued);
      ordered.forEach((t, i) => { for (const e of [...part('bar', i), ...part('value', i), ...(i ? part('link', i - 1) : [])]) e.at += t - times[i]; });
      const landed = Math.max(...props.elements.filter(e => /-bridge-(bar|value|link)-\d+(-\d+)?$/.test(e.id ?? '')).map(e => e.at + (e.dur ?? 0)));
      settle = Math.max(settle, landed);
      if (b.dur - landed < 1.5)
        report.warnings.push(`${b.id}: the bridge's last total settles ${landed.toFixed(1)} s into a ${b.dur.toFixed(1)} s beat; cue it earlier or hold the beat (min) so it can be read.`);
      if (landed > b.dur) throw new Error(`the bridge finishes at ${landed.toFixed(2)} s, after the beat ends; cue the drivers earlier or extend the beat.`);
    }
    // Camera depth keys resolve their spoken cues; like camera drift, they never hold the beat.
    for (const k of [...(props.dolly ?? []), ...(props.focus?.keys ?? [])]) {
      if (k.say != null) {
        k.at = cue(k.say);
        delete k.say;
      }
      k.dur ??= 1.2;
    }
    props.dolly?.sort((a, b) => a.at - b.at);
    props.focus?.keys?.sort((a, b) => a.at - b.at);
    if (props.sourceElement && !sb.sources.length) throw new Error('sourceElement requires storyboard.sources.');
    const visibleSource = props.source || props.sourceElement;
    if (hasCount(props.elements) && (!visibleSource || !sb.sources.length))
      throw new Error('Counted numbers need visible props.source and a storyboard.sources entry.');
    if (hasDigits(props.elements) && !visibleSource)
      report.warnings.push(`${b.id}: canvas text contains digits; if they are figures, add a visible source.`);
  }
  const art = source.art != null ? artLayers(source.art, b.id, { width: timing.width, height: timing.height, duration: b.dur }) : null;
  if (art) settle = Math.max(settle, scheduleArt(art.under, at), scheduleArt(art.over, at));
  const paced = keepPace(b, source, props, art, at, { sb, report });
  const layers = beatLayers(source, b, sb, report);
  if (layers.camera?.to) {
    const c = layers.camera;
    c.at = c.say != null ? cue(c.say) : (c.at ?? 0.6);
    delete c.say;
    c.dur ??= 1.4;
  }
  if (spec.numeric) {
    if (!props.source || !sb.sources.length)
      throw new Error('Numbers need visible props.source and a storyboard.sources entry.');
    if (settle > b.dur - frame + 1e-6)
      (report.draft ? report.warnings : report.errors).push(
        `${b.id}: values finish counting at ${settle.toFixed(2)}s but the beat ends at ${b.dur.toFixed(2)}s, so the final figures would never be shown; extend the beat or cue earlier.`,
      );
  }
  glyphCheck(props, `${b.id}.props`, m => {
    throw new Error(m);
  });
  // Display text set in the voice's face is checked against that face's own coverage.
  const voice = source.type != null ? (voiceOf(source.type, typeById(source.type)) ?? DEFAULT_VOICE) : film.type;
  const face = voiceFace(voice);
  if (face && (spec.hero || ['chapter', 'highlight'].includes(b.block) || props.title != null))
    for (const k of ['text', 'title'])
      if (typeof props[k] === 'string')
        glyphCheck(props[k], `${b.id}.props.${k}`, m => {
          throw new Error(m);
        }, face);
  checkNarration(b, frame, film.captions, report, b.block === 'kinetic' ? face : null);
  const transition = transitions[b.index];
  if (!TRANSITIONS.includes(transition)) throw new Error(`Unsupported native transition ${transition}`);
  const authoredExit = source.exit ?? 'auto';
  if (!EXITS.includes(authoredExit)) throw new Error(`exit must be ${EXITS.join(', ')}`);
  const startFrame = Math.round(b.start * timing.fps),
    frames = Math.round(b.end * timing.fps) - startFrame;
  // Something that arrives just before the cut is seen for a blink; viewers need ~0.5 s.
  const hold = frames / timing.fps - settle;
  if (hold >= 0 && hold < 0.45 && b.index < timing.beats.length - 1 && b.block !== 'kinetic')
    report.warnings.push(
      `${b.id}: the last element lands ${hold.toFixed(2)} s before the cut. Cue it earlier, or add hold/tail so it can be read.`,
    );
  return {
    id: b.id,
    block: b.block,
    frames,
    start_frame: startFrame,
    cue_seconds: paced?.cue ?? at,
    ...(paced ? { count_seconds: paced.count } : {}),
    transition,
    exit: exitFor(authoredExit, transitions[b.index + 1]),
    settle_seconds: Math.max(0, Math.min(settle, frames / timing.fps)),
    motion,
    props,
    ...(art ? { art } : {}),
    ...layers,
    words: (b.vo?.words ?? []).map(w => ({
      text: w.w,
      start: Math.max(0, w.t0 - startFrame / timing.fps),
      end: Math.min(w.t1 - startFrame / timing.fps, frames / timing.fps),
    })),
    // A caption belongs to the beat it starts in; at a shared boundary (continuous takes),
    // rounding must not drop the next beat's first caption into this one with no length.
    captions: captions
      .filter(c => c.start >= b.start - frame / 2 && c.start < b.end - frame / 2)
      .map(c => ({ start: Math.max(0, c.start - b.start), end: Math.min(c.end, b.end) - b.start, text: c.text })),
  };
}

/** Seconds or a spoken word/phrase → scene seconds. */
function cueResolver(b, frame) {
  return (value, fallback = 0.35) => {
    if (value == null) return Math.min(fallback, Math.max(0, b.dur - frame));
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value >= b.dur)
        throw new Error('Cue seconds must lie within the beat');
      return value;
    }
    const t = findWord(b.vo?.words ?? [], String(value));
    if (t == null) throw new Error(`Spoken cue "${value}" not found`);
    return Math.max(0, t - b.start);
  };
}

/**
 * Staged items fit inside the beat: automatic spacing compresses, authored cues never move,
 * and a cue too late to finish its entrance fails instead of being hidden.
 */
function stageItems(props, { key, offset, spacing: nominal, itemSeconds }, { b, frame, at, authored, cue, entrance }) {
  const items = props[key];
  const duration = itemSeconds(entrance);
  const lastStart = b.dur - frame - duration;
  if (lastStart < 0)
    throw new Error(`Beat is too short for its ${duration.toFixed(2)}s item entrance; extend the beat.`);
  if (authored != null && at > lastStart + 1e-7)
    throw new Error('Scene cue is too late to complete its item entrances; extend the beat or move the cue.');
  const start = Math.min(at + offset, Math.max(at, lastStart));
  const latest = Math.max(authored != null ? at : 0, lastStart - Math.min(0.3, b.dur * 0.1));
  const first = authored != null ? start : Math.min(start, latest);
  const spacing =
    items.length > 1 ? Math.max(0, Math.min(nominal ?? props.stagger, (latest - first) / (items.length - 1))) : 0;
  props[key] = items.map((it, i) => {
    const time = it.say == null ? first + i * spacing : cue(it.say);
    if (time > lastStart + 1e-7)
      throw new Error('Item cue is too late to complete its entrance; extend the beat or move the cue.');
    const { say, ...rest } = it;
    return { ...rest, at: time };
  });
}

function artLayers(a, id, frame) {
  if (
    !a ||
    typeof a !== 'object' ||
    Array.isArray(a) ||
    Object.keys(a).some(k => !['under', 'over', 'rough', 'sketch', 'seed', 'opacity', 'drift'].includes(k))
  )
    throw new Error('art must be {sketch, seed, opacity, drift, under: [...], over: [...], rough}');
  if (a.sketch == null && (a.seed != null || a.opacity != null || a.drift != null))
    throw new Error('art.seed, art.opacity and art.drift require art.sketch');
  a = expandArt(a, frame);
  const state = { count: 0 };
  const fail = m => {
    throw new Error(`art: ${m}`);
  };
  const art = {
    under: normalizeElements(a.under ?? [], 'art.under', fail, state),
    over: normalizeElements(a.over ?? [], 'art.over', fail, state),
  };
  if (a.rough != null && a.rough !== false) {
    const r = roughSpec(a.rough, 'art.rough', fail);
    applyRough(art.under, r);
    applyRough(art.over, r);
  }
  glyphCheck(art, `${id}.art`, m => {
    throw new Error(m);
  });
  return art;
}

/**
 * Pacing: the picture never waits for the voice. When a scene would sit empty for more than
 * ~0.7 s after its narration starts (every element cued to a late word), the first drawing is
 * pulled forward to the first word and reported; other blocks are reported. `pace: "hold"`
 * on a beat keeps a deliberate wait. World beats after the first already show the world.
 */
function keepPace(b, source, props, art, at, { sb, report }) {
  const first = b.vo?.words?.find(w => w.t1 > w.t0);
  if (!first || source.pace === 'hold') return;
  const voice = Math.max(0, first.t0 - b.start);
  const continuing =
    b.block === 'canvas' &&
    props.world &&
    sb.beats.slice(0, b.index).some(x => x.block === 'canvas' && x.props?.world === props.world);
  if (continuing) return;
  const own = b.block === 'canvas' ? (props.elements ?? []) : [];
  const layers = [...own, ...(art?.under ?? []), ...(art?.over ?? [])];
  const earliest = layers.length ? Math.min(...layers.map(el => el.at ?? 0)) : Infinity;
  // Sequence bodies arrive on their item cues, not the block cue. Highlight and annotate
  // already show text/an image before their staged markers, so keep their block cue.
  const staged = rules(b.block).staged;
  const itemCued = staged && !['highlight', 'annotate'].includes(b.block);
  const body = itemCued ? Math.min(...props[staged.key].map(it => it.at)) : at;
  // An authored plate is already a picture behind the delayed information.
  const picture = source.plate || props.plates ? 0 : Infinity;
  const content = Math.min(b.block === 'canvas' ? earliest : Math.min(body, earliest), picture);
  const allowance = b.block !== 'canvas' && props.title ? 1.6 : 0.7;
  const gap = content - voice;
  if (!(gap > allowance)) return;
  if (b.block === 'canvas' && own.length) {
    const shift = content - Math.max(0, voice - 0.1);
    const pulled = own.filter(el => (el.at ?? 0) <= earliest + 1e-6);
    const move = el => {
      el.at = Math.max(0, (el.at ?? 0) - shift);
      if (el.type === 'group') el.children?.forEach(move);
    };
    pulled.forEach(move);
    report.warnings.push(
      `${b.id}: the voice would talk for ${gap.toFixed(1)} s over an empty scene; pulled the first drawing (${pulled[0].id ?? pulled[0].type}) forward to the first word. Cue something to the opening words, or set pace: "hold" for a deliberate wait.`,
    );
    return;
  }
  // Number blocks enter with the voice; their count still starts where it lands on its word.
  if (['stat', 'delta', 'ring', 'waffle'].includes(b.block)) {
    report.warnings.push(
      `${b.id}: the ${b.block} entered with the voice (${gap.toFixed(1)} s earlier than its count) so the scene is never empty; the figure still lands on its word.`,
    );
    return { cue: Math.max(0, voice - 0.1), count: at };
  }
  report.warnings.push(
    `${b.id}: the voice starts ${gap.toFixed(1)} s before the ${itemCued ? 'first staged item' : 'picture'} arrives. ${itemCued ? 'Cue an item to the opening words (item say overrides land)' : `Cue the ${b.block} earlier (land on an earlier word)`}, or add a plate or art at: 0 with enter: "none" for the lead-in. Use pace: "hold" only for a reviewed, deliberate wait.`,
  );
}

/** Tone, graphic-transition style, frame label, speaker, camera and plate. */
function beatLayers(source, b, sb, report) {
  const out = {};
  // The lens is resolved per beat: film settings, then the beat's own.
  const lens = { ...(sb.lens ?? {}), ...(lensSpec(source.lens) ?? {}) };
  const steady = steadyFilm(sb);
  if (steady && lens.handheld > 0)
    report.warnings.push(`${source.id}: this is a steady film (camera: none${sb.treatment === 'business' ? ', business treatment' : ''}) but the lens adds handheld sway; set lens.handheld: 0 unless the brief explicitly calls for it.`);
  if (source.plate && (source.plate.side ?? 'full') === 'full')
    report.warnings.push(`${source.id}: inspect native text over background media at opening, middle, end and lighting changes, including 360 px. Blur/scrim alone does not prove legibility; use a split or opaque panel if needed.`);
  if (lens.letterbox === false) lens.letterbox = 0;
  if (Object.keys(lens).length) out.lens = lens;
  const heading = source.heading ?? sb.heading;
  if (heading != null) {
    if (!['top', 'bottom'].includes(heading)) throw new Error('heading must be top or bottom');
    out.heading = heading;
  }
  if (source.textMotion != null) {
    if (!TEXT_MOTIONS.includes(source.textMotion)) throw new Error(`textMotion must be ${TEXT_MOTIONS.join(', ')}`);
    out.text_motion = source.textMotion;
  }
  // A scene's own type voice (a trailer card inside a didone film); `inter` opts back out.
  if (source.type != null) out.type = voiceOf(source.type, typeById(source.type)) ?? DEFAULT_VOICE;
  if (source.tone != null) {
    if (!TONES.includes(source.tone)) throw new Error(`tone must be ${TONES.join(', ')}`);
    out.tone = source.tone;
  }
  if (source.transitionColor != null || source.transitionOrigin != null) {
    if (source.transitionColor != null && !TRANSITION_COLORS.includes(source.transitionColor))
      throw new Error(`transitionColor must be ${TRANSITION_COLORS.join(', ')}`);
    const o = source.transitionOrigin;
    if (o != null && !(Array.isArray(o) && o.length === 2 && o.every(unit)))
      throw new Error('transitionOrigin must be [x, y] from 0 to 1');
    out.enter_style = {
      ...(source.transitionColor ? { color: source.transitionColor } : {}),
      ...(o ? { origin: o } : {}),
    };
  }
  if (source.label != null && (typeof source.label !== 'string' || source.label.length > 40))
    throw new Error('label must be text up to 40 characters');
  const label = source.label ?? (sb.frame && typeof b.chapter === 'string' ? b.chapter.slice(0, 40) : '');
  if (label) out.label = label;
  if (source.speaker && sb.speakers?.[source.speaker])
    out.speaker = {
      ...sb.speakers[source.speaker],
      id: source.speaker,
      continues: b.index > 0 && sb.beats[b.index - 1].speaker === source.speaker,
    };
  // The film's camera is the default for beats without their own, resolved here so a beat
  // added after `new` still follows it. A system diagram is a reading frame: it holds still
  // unless someone asks for a move.
  if (sb.camera != null && (typeof sb.camera === 'object' && sb.camera.to != null))
    throw new Error('the film camera is a default move; push to a detail (camera.to) on a beat');
  // Diagrams and casts lay themselves out for a still frame (their objects move instead).
  const authoredCamera = source.camera ?? sb.camera ?? (b.block === 'canvas' && (source.props?.diagram != null || source.props?.cast != null) ? 'none' : null);
  if (authoredCamera != null) {
    const camera = typeof authoredCamera === 'string' ? { move: authoredCamera } : structuredClone(authoredCamera);
    if (
      !camera ||
      typeof camera !== 'object' ||
      Object.keys(camera).some(k => !['move', 'amount', 'to', 'at', 'say', 'dur'].includes(k)) ||
      !CAMERA_MOVES.includes(camera.move ?? 'auto') ||
      (camera.amount != null && !unit(camera.amount))
    )
      throw new Error(
        `camera must be ${CAMERA_MOVES.join('|')}, {move, amount: 0–1} or {to: [x, y, w, h], say|at, dur}`,
      );
    // A push to a detail: the picture travels from the full frame into a frame-pixel rect.
    if (camera.to != null) {
      const r = camera.to;
      if (!(Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[2] >= 64 && r[3] >= 36))
        throw new Error('camera.to must be a frame-pixel rect [x, y, w, h] (at least 64 × 36)');
      if (camera.dur != null && !(Number.isFinite(camera.dur) && camera.dur >= 0.2 && camera.dur <= 8))
        throw new Error('camera.dur must be 0.2–8 seconds');
    }
    out.camera = camera;
  }
  if (source.plate != null) out.plate = plateSpec(source.plate, b.block);
  // A steady film's plates hold still too; a drift is something a beat asks for.
  if (out.plate && steady) out.plate.drift ??= 'none';
  motionStack(source, b, sb, out, lens, report);
  return out;
}

/** A film whose default camera is still: business films and any storyboard with camera none. */
export const steadyFilm = sb =>
  sb.treatment === 'business' || (typeof sb.camera === 'string' ? sb.camera : sb.camera?.move) === 'none';

/**
 * Whole-frame motion has several independent sources — the scene camera, the handheld lens,
 * a drifting plate and the movement inside footage. Each is fine alone; stacked they read as
 * shake, and nothing moving inside the footage can be steadied by the native camera.
 */
function motionStack(source, b, sb, out, lens, report) {
  const moves = [];
  const cam = out.camera, move = cam?.to ? 'push' : (cam?.move ?? 'auto');
  const holds = ['kinetic', 'video', 'annotate', 'breathing'].includes(b.block);
  if (move === 'push') moves.push('a push to a detail');
  else if (move === 'auto' ? !holds : move !== 'none') moves.push(move === 'auto' ? 'the automatic slow push' : `camera ${move}`);
  if (lens.handheld > 0) moves.push(`handheld ${lens.handheld}`);
  if (out.plate && (out.plate.drift ?? 'in') !== 'none') moves.push(`plate drift ${out.plate.drift ?? 'in'}`);
  const ref = out.plate ?? (b.block === 'video' ? source.props : null);
  const asset = ref?.asset != null ? sb.assets?.find(a => a.id === ref.asset) : null;
  const footage = !!ref && (asset?.kind === 'clip' || /\.(mp4|mov|webm|m4v)$/i.test(ref.file ?? ''));
  if (footage && (lens.handheld > 0 || (out.plate && (out.plate.drift ?? 'in') !== 'none')))
    report.warnings.push(
      `${source.id}: footage carries its own camera motion; ${moves.filter(m => m.startsWith('handheld') || m.startsWith('plate')).join(' and ')} on top of it reads as shake. Set plate.drift: "none" and lens.handheld: 0 for this beat, and ask the generator for a locked camera.`,
    );
  else if (moves.length >= 3 || (moves.length >= 2 && lens.handheld > 0))
    report.warnings.push(
      `${source.id}: ${moves.join(', ')} move the whole frame at once. Keep the one move that reveals something and still the rest.`,
    );
}

function plateSpec(input, block) {
  const plate = structuredClone(input);
  if (!plate || typeof plate !== 'object' || Array.isArray(plate)) throw new Error('plate must be an object');
  for (const k of Object.keys(plate))
    if (!['asset', 'file', 'side', 'treatment', 'drift', 'scrim', 'focus', 'offset', 'loop'].includes(k))
      throw new Error(`plate: unsupported field ${k}`);
  if (!plate.asset && !plate.file) throw new Error('plate needs asset or file');
  if (plate.side != null && !PLATE_SIDES.includes(plate.side))
    throw new Error(`plate.side must be ${PLATE_SIDES.join(', ')}`);
  if (plate.treatment != null && !TREATMENTS.includes(plate.treatment))
    throw new Error(`plate.treatment must be ${TREATMENTS.join(', ')}`);
  if (plate.drift != null && !DRIFTS.includes(plate.drift)) throw new Error(`plate.drift must be ${DRIFTS.join(', ')}`);
  if (plate.loop != null && typeof plate.loop !== 'boolean') throw new Error('plate.loop must be boolean');
  if (plate.loop === true) throw new Error('B-roll must cover the beat without looping; trim the scene, select a source range or provide a longer clip.');
  if (plate.scrim != null && !unit(plate.scrim)) throw new Error('plate.scrim must be 0–1');
  if (plate.focus != null && !(Array.isArray(plate.focus) && plate.focus.length === 2 && plate.focus.every(unit)))
    throw new Error('plate.focus must be [x, y] from 0 to 1');
  if (plate.offset != null && !(Number.isFinite(plate.offset) && plate.offset >= 0))
    throw new Error('plate.offset must be nonnegative');
  if (['image', 'video', 'annotate'].includes(block) && (plate.side ?? 'full') !== 'full')
    throw new Error('media blocks already show media; use a full plate or a canvas');
  return plate;
}

function checkNarration(b, frame, captions, report, face = null) {
  const soft = report.draft ? report.warnings : report.errors;
  if (b.vo?.estimated) soft.push(`${b.id}: narration is estimated; record/import audio or use --draft.`);
  if (b.vo && (b.vo.start < b.start - 1e-3 || b.vo.end > b.end + frame))
    throw new Error('Narration crosses beat bounds; remove the forced duration/negative lead.');
  if (b.block === 'kinetic' && !b.vo?.words?.length) throw new Error('kinetic needs narration and word timestamps.');
  if ((b.block === 'kinetic' || captions) && b.vo) {
    glyphCheck(b.vo.text, `${b.id}.vo (shown as ${b.block === 'kinetic' ? 'kinetic text' : 'captions'})`, m => {
      throw new Error(m);
    });
    if (face)
      glyphCheck(b.vo.text, `${b.id}.vo (shown as kinetic text)`, m => {
        throw new Error(m);
      }, face);
    if (b.vo.wordTiming !== 'measured')
      soft.push(
        `${b.id}: speech-following text requires measured word timestamps; run align or import timed speech.${b.vo.alignmentIssue ? ' ' + b.vo.alignmentIssue : ''}`,
      );
  }
}

/** A scene's exit mirrors the next scene's entrance unless authored. */
function exitFor(authored, next) {
  if (authored !== 'auto') return authored;
  if (next == null) return 'fade';
  if (next === 'cut' || next === 'flash' || next === 'dissolve') return 'none';
  if (next === 'rise') return 'fade';
  return next;
}

// ------------------------------------------------------------------ across beats

function mirrorExitStyles(beats) {
  for (let i = 0; i + 1 < beats.length; i++)
    if (beats[i + 1].enter_style && beats[i].exit === beats[i + 1].transition)
      beats[i].exit_style = beats[i + 1].enter_style;
}

/**
 * A cast carries its objects across cuts by handing each beat's end state to the next, so the
 * picture must not move under them: consecutive cast beats cut (no exit, no transition) and hold
 * the camera still unless the author set one.
 */
function linkCasts(beats, sb, timing, { warnings }, cast = {}) {
  // A cast object that fills the frame hands the next scene its colour (that scene's tone), and one
  // that emerges comes out of the last scene's: a cut on one flat colour, so the handoff is unbroken.
  for (let i = 0; i < beats.length; i++) {
    const edges = cast.edges?.[beats[i].id];
    for (const [tone, j] of [[edges?.fill, i + 1], [edges?.emerge, i - 1]]) {
      if (!tone || !beats[j]) continue;
      const src = sb.beats[timing.beats[j].index];
      if (src.props?.cast != null) continue;
      if (src.tone && src.tone !== tone) { warnings.push(`${beats[j].id}: its tone ${src.tone} differs from the ${tone} the cast hands it in ${beats[i].id}; the cut will flash.`); continue; }
      const [a, b] = j > i ? [beats[i], beats[j]] : [beats[j], beats[i]], authored = sb.beats[timing.beats[beats.indexOf(b)].index].transition;
      beats[j].tone = tone;
      if (authored && authored !== 'cut') { warnings.push(`${b.id}: a ${authored} transition hides the colour handoff from the cast; use cut.`); continue; }
      a.exit = 'none'; b.transition = 'cut';
    }
  }
  for (let i = 1; i < beats.length; i++) {
    const [srcA, srcB] = [sb.beats[timing.beats[i - 1].index], sb.beats[timing.beats[i].index]];
    if (srcA.props?.cast == null || srcB.props?.cast == null || beats[i].block !== 'canvas' || beats[i - 1].block !== 'canvas') continue;
    if (srcB.transition && srcB.transition !== 'cut') { warnings.push(`${beats[i].id}: the cast carries across from ${beats[i - 1].id}; a ${srcB.transition} transition hides that, use cut.`); continue; }
    beats[i].transition = 'cut';
    beats[i - 1].exit = 'none';
    for (const [beat, src] of [[beats[i - 1], srcA], [beats[i], srcB]]) if (!src.camera) beat.camera = { move: 'none' };
  }
}

/**
 * Morph by id: an element whose id also appears in the previous beat animates from that
 * element's geometry and colour across the cut, like Magic Move.
 */
function linkMorphs(beats, sb, timing, { warnings }) {
  const layers = b => [
    ...(b.block === 'canvas' ? b.props.elements : []),
    ...(b.art?.under ?? []),
    ...(b.art?.over ?? []),
  ];
  for (let i = 1; i < beats.length; i++) {
    const prev = new Map(
      layers(beats[i - 1])
        .filter(el => el.id)
        .map(el => [el.id, el]),
    );
    let linked = false;
    for (const el of layers(beats[i])) {
      const from = el.id && prev.get(el.id);
      if (!from) continue;
      const { morph, echo, keys, loop, along, exitAt, exitDur, exit, ...state } = from;
      if (keys?.length)
        warnings.push(`${beats[i].id}: morph source "${el.id}" has keys; the morph starts from its unkeyed geometry.`);
      el.morph = { from: { ...state, at: 0, dur: 0, enter: 'none' }, dur: el.morphDur ?? 0.8 };
      // A group's contents arrive with it; they are already on screen across the cut, while
      // later changes inside the group (a status redrawn, a pulse) keep their own times.
      if (el.type === 'group') {
        const arrived = el.at ?? 0;
        eachElement(el.children, child => {
          if ((child.at ?? 0) <= arrived + 1e-6) Object.assign(child, { at: 0, dur: 0, enter: 'none' });
        });
      }
      Object.assign(el, { enter: 'none', at: 0, dur: 0 });
      delete el.morphDur;
      delete from.exit;
      delete from.exitAt;
      delete from.exitDur;
      linked = true;
    }
    if (!linked) continue;
    const a = beats[i - 1],
      b = beats[i],
      src = sb.beats[timing.beats[i].index];
    if (src.transition && src.transition !== 'cut')
      warnings.push(`${b.id}: elements morph from ${a.id}; a ${src.transition} transition hides the morph, use cut.`);
    else {
      b.transition = 'cut';
      a.exit = 'none';
    }
    // A camera move would shift one side of the cut; morphing pairs hold still unless authored.
    for (const [beat, s] of [
      [a, sb.beats[timing.beats[i - 1].index]],
      [b, src],
    ])
      if (!s.camera) beat.camera = { move: 'none' };
    if (
      a.block === 'canvas' &&
      b.block === 'canvas' &&
      JSON.stringify(a.props.view ?? null) !== JSON.stringify(b.props.view ?? null)
    )
      warnings.push(`${b.id}: morphing canvases use different views; positions will jump.`);
  }
}

/**
 * Canvas beats that name the same `world` are one drawing: each inherits everything drawn
 * before (on its original clock, so loops and exits carry on) and the camera travels from
 * the last view to the new one. Consecutive world beats cut invisibly; a world beat after
 * an interruption (a kinetic card, a chart) returns to where the camera left off.
 */
function linkWorlds(beats, sb, timing, { warnings }) {
  const fps = timing.fps,
    last = new Map();
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    // A camera rect authored for another frame shape (a landscape world in a vertical cut)
    // is re-framed on what this beat draws.
    if (b.block === 'canvas' && Array.isArray(b.props.view) && b.props.view.length === 4) {
      const tall = timing.height > timing.width;
      b.props.view =
        tall && b.props.viewTall
          ? b.props.viewTall
          : reframeView(b.props.view, b.props.elements, timing.width / timing.height);
    }
    if (b.block === 'canvas') delete b.props.viewTall;
    // The camera crops the world on purpose, but a beat's own words must be in its shot.
    const v = b.block === 'canvas' && Array.isArray(b.props.view) && b.props.view.length === 4 && b.props.view;
    // Parallax layers are placed for the view they were drawn in.
    if (v)
      for (const el of b.props.elements)
        if (el.depth != null || el.z != null) el.depthRef ??= [v[0] + v[2] / 2, v[1] + v[3] / 2];
    if (v)
      for (const el of b.props.elements.filter(el => el.type === 'text' && !el.carried)) {
        const e = elementsExtent([el]);
        if (e && (e.left < v[0] || e.top < v[1] || e.left + e.w > v[0] + v[2] || e.bottom > v[1] + v[3]))
          warnings.push(`${b.id}: text "${String(el.text).slice(0, 30)}" reaches outside this beat's camera view.`);
        // Through the camera, a label's size on screen is its size times the zoom.
        const zoom =
          Math.min(timing.width / v[2], timing.height / v[3]) * (1080 / Math.min(timing.width, timing.height));
        const px = (el.size ?? 48) * zoom;
        if (px < 22)
          warnings.push(
            `${b.id}: text "${String(el.text).slice(0, 30)}" renders at about ${Math.round(px)} px; make it at least ${Math.ceil(22 / zoom)} in world units.`,
          );
      }
    const name = b.block === 'canvas' && b.props.world;
    if (!name) continue;
    b.props.viewDrift ??= 0.03;
    const a = last.get(name);
    last.set(name, b);
    if (!a) continue;
    const adjacent = beats[i - 1] === a;
    const shift = (b.start_frame - a.start_frame) / fps;
    const carried = [],
      own = [];
    for (const el of a.props.elements) (el.carried ? carried : own).push(el);
    const group = (children, behind) => ({
      type: 'group',
      carried: true,
      behind,
      at: 0,
      dur: 0,
      enter: 'none',
      shift,
      children,
    });
    const moved = g => ({ ...g, shift: g.shift + shift });
    const layer = behind => [
      ...carried.filter(g => !!g.behind === behind).map(moved),
      ...(own.some(el => !!el.behind === behind)
        ? [
            group(
              own.filter(el => !!el.behind === behind),
              behind,
            ),
          ]
        : []),
    ];
    // `behind` elements (a sky changing colour, a glow under the city) stay under the world,
    // newest above older ones; everything else draws over what came before.
    const mine = b.props.elements;
    b.props.elements = [
      ...layer(true),
      ...mine.filter(el => el.behind),
      ...layer(false),
      ...mine.filter(el => !el.behind),
    ];
    const src = sb.beats[timing.beats[i].index];
    // A graphic transition between two world beats cuts to the new view under its cover.
    const covered = adjacent && src.transition && src.transition !== 'cut';
    if (adjacent && !covered) {
      b.transition = 'cut';
      a.exit = 'none';
    }
    if (!covered && !b.props.viewFrom && JSON.stringify(a.props.view) !== JSON.stringify(b.props.view)) {
      // Start where the last beat's camera ended: its view, drifted in.
      const [x, y, w, h] = a.props.view,
        d = a.props.viewDrift ?? 0;
      b.props.viewFrom = [x + (w * d) / 2, y + (h * d) / 2, w * (1 - d), h * (1 - d)];
      b.props.viewDur ??= 1.2;
      // Land on the new line, not after it: arrive by its first word or first new drawing.
      // Across a cut the move starts in the outgoing beat's tail (once it has settled).
      const subjects = b.props.elements.filter(el => !el.carried && !el.behind && el.enter !== 'none');
      const firstNew = Math.min(...subjects.map(el => el.at ?? 0));
      const firstWord = b.words?.find(w => w.end > w.start)?.start ?? Infinity;
      const land = Math.max(0.25, Math.min(firstNew, firstWord));
      let at = b.props.viewAt ?? (Number.isFinite(land) ? land - b.props.viewDur : 0);
      if (at < 0 && b.props.viewAt == null) {
        // Leave once the outgoing line has been said (its drawings may finish on the move);
        // with little room, travel faster (down to 0.8 s) rather than land late.
        const aDur = a.frames / fps,
          lastWord = Math.max(0, ...(a.words ?? []).map(w => w.end));
        const room = adjacent ? Math.max(0, Math.min(1.2, aDur - lastWord - 0.1, aDur / 2)) : 0;
        if (room < -at) b.props.viewDur = Math.max(0.8, Math.min(b.props.viewDur, land + room));
        at = Math.max(land - b.props.viewDur, -room);
      }
      if (at < 0) a.props.viewNext = { to: b.props.view, at: a.frames / fps + at, dur: b.props.viewDur };
      b.props.viewAt = at;
      b.settle_seconds = Math.max(b.settle_seconds, at + b.props.viewDur);
    }
    for (const [beat, s] of [
      [a, sb.beats[timing.beats[beats.indexOf(a)].index]],
      [b, src],
    ])
      if (!s.camera) beat.camera = { move: 'none' };
  }
}

function frameChrome(sb, beats, { errors }) {
  if (sb.frame == null || sb.frame === false) return null;
  const fail = m => errors.push(m);
  const f = sb.frame === true ? {} : sb.frame;
  if (
    !f ||
    typeof f !== 'object' ||
    Array.isArray(f) ||
    Object.keys(f).some(k => !['brand', 'left', 'right', 'label', 'progress'].includes(k))
  ) {
    fail('frame must be true or {brand, left, right, label, progress}.');
    return null;
  }
  for (const k of ['brand', 'left', 'right'])
    if (f[k] != null && (typeof f[k] !== 'string' || f[k].length > 40))
      fail(`frame.${k} must be text up to 40 characters.`);
  for (const k of ['label', 'progress'])
    if (f[k] != null && typeof f[k] !== 'boolean') fail(`frame.${k} must be true or false.`);
  if (f.brand) glyphCheck(f.brand, 'frame.brand', fail, 'serif-italic');
  for (const k of ['left', 'right']) if (f[k]) glyphCheck(f[k].toUpperCase(), `frame.${k}`, fail, 'mono');
  for (const b of beats) if (b.label) glyphCheck(b.label.toUpperCase(), `${b.id}.label`, fail, 'mono');
  return { ...f };
}

/**
 * A graphic transition covers the cut, so the outgoing scene must have room to finish its
 * cover after its last word and settled values; otherwise fall back to a fade.
 */
function fitGraphicTransitions(beats, timing, { warnings }) {
  for (let i = 0; i + 1 < beats.length; i++) {
    const a = beats[i],
      next = beats[i + 1],
      cover = COVER[next.transition];
    if (!cover) continue;
    const seconds = a.frames / timing.fps;
    const earliest = Math.max(
      a.words.at(-1)?.end ?? 0,
      ENTRANCE[a.motion.preset] + 0.25,
      a.settle_seconds,
      COVER[a.transition]?.[1] ?? 0,
    );
    if (seconds - earliest < cover[0] - 1e-6 && a.exit === next.transition) {
      // Name what actually holds the scene: the voice, or an element still moving.
      const spoken = a.words.at(-1)?.end ?? 0;
      const cause =
        a.settle_seconds > spoken + 1e-3
          ? `an element is still moving until ${a.settle_seconds.toFixed(2)}s (a key, count or exit); end it earlier`
          : 'the line runs to the end of the beat; add tail or shorten the line';
      warnings.push(
        `${a.id} → ${next.id}: no room for the ${next.transition} transition (${(seconds - earliest).toFixed(2)}s free, needs ${cover[0]}s): ${cause}. Using a fade.`,
      );
      next.transition = 'fade';
      a.exit = 'fade';
    }
  }
}

function filmWarnings(sb, timing, theme, { warnings }) {
  const luminance = hex => {
    const rgb = hex
      .slice(1)
      .match(/../g)
      .map(v => parseInt(v, 16) / 255)
      .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const key of ['ink', 'muted', 'accent'])
    if (contrast(theme[key], theme.bg) < 4.5)
      warnings.push(`Palette ${key} has low text contrast against bg; review small text at delivery size.`);
  if (contrast(theme.accent2, theme.bg) < 3)
    warnings.push(
      'Palette accent2 has low graphic contrast (< 3:1) against bg; second series and chart segments may be hard to see.',
    );
  const generated = timing.beats
    .filter(b => b.block === 'video' && sb.assets.some(a => a.id === b.props?.asset && !a.file))
    .reduce((n, b) => n + b.dur, 0);
  if (generated > timing.duration * (sb.continuity?.maxGeneratedShare ?? 0.2))
    warnings.push(
      'Generated footage exceeds the configured runtime share (default 20%); use native graphics where they carry the story.',
    );
}
