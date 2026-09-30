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
} from './constants.mjs';
import { glyphCheck } from './glyphs.mjs';
import { rules } from './registry.mjs';
import { captionCues, findWord } from '../engine/lib/timing.mjs';

const unit = v => Number.isFinite(v) && v >= 0 && v <= 1;
const validMotion = m => MOTIONS.includes(m.preset) && unit(m.intensity);

/** Build the job; errors block rendering, warnings are advice (drafts demote some errors). */
export function createJob(sb, timing, { draft = false } = {}) {
  const report = { errors: [], warnings: [], draft };
  const film = filmSettings(sb, timing, report);
  const transitions = timing.beats.map(b => {
    let t = sb.beats[b.index].transition ?? sb.transition ?? 'fade';
    if (t === 'auto') t = b.index && timing.beats[b.index - 1].chapter !== b.chapter ? 'rise' : 'fade';
    return t;
  });
  const captions = captionCues(timing);
  const beats = [];
  for (const b of timing.beats) {
    try {
      beats.push(prepareBeat(b, { sb, timing, film, transitions, captions, report }));
    } catch (e) {
      report.errors.push(`${b.id}: ${e.message}`);
    }
  }
  mirrorExitStyles(beats);
  linkMorphs(beats, sb, timing, report);
  linkWorlds(beats, sb, timing, report);
  const frame = frameChrome(sb, beats, report);
  fitGraphicTransitions(beats, timing, report);
  filmWarnings(sb, timing, film.theme, report);
  if (beats.some(b => b.frames < 1) || beats.reduce((n, b) => n + b.frames, 0) !== timing.frames)
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
  const textMotion = sb.textMotion ?? 'lines';
  if (!TEXT_MOTIONS.includes(textMotion)) errors.push(`textMotion must be ${TEXT_MOTIONS.join(', ')}.`);
  return {
    textMotion,
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

function prepareBeat(b, { sb, timing, film, transitions, captions, report }) {
  if (b.scene)
    throw new Error('JavaScript scenes are retired. Port this beat to a native block; no browser fallback runs.');
  const frame = 1 / timing.fps,
    source = sb.beats[b.index],
    spec = rules(b.block);
  const props = normalizeProps(b.block, b.props ?? {}, { vertical: film.vertical });
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
    const end = scheduleElements(list, { start, stagger, entrance, resolve: v => cue(v) });
    eachElement(list, el => {
      if (el.at > b.dur - frame + 1e-7)
        throw new Error(
          `a canvas element is cued at ${el.at.toFixed(2)}s, after the beat ends; extend the beat or move the cue.`,
        );
    });
    return end;
  };
  if (b.block === 'canvas') {
    settle = Math.max(settle, scheduleArt(props.elements, at, props.stagger ?? 0));
    if (hasCount(props.elements) && (!props.source || !sb.sources.length))
      throw new Error('Counted numbers need visible props.source and a storyboard.sources entry.');
    if (hasDigits(props.elements) && !props.source)
      report.warnings.push(`${b.id}: canvas text contains digits; if they are figures, add a visible source.`);
  }
  const art = source.art != null ? artLayers(source.art, b.id) : null;
  if (art) settle = Math.max(settle, scheduleArt(art.under, at), scheduleArt(art.over, at));
  const layers = beatLayers(source, b, sb);
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
  checkNarration(b, frame, film.captions, report);
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
    cue_seconds: at,
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
    captions: captions
      .filter(c => c.start >= b.start && c.start < b.end)
      .map(c => ({ start: c.start - b.start, end: Math.min(c.end, b.end) - b.start, text: c.text })),
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

function artLayers(a, id) {
  if (
    !a ||
    typeof a !== 'object' ||
    Array.isArray(a) ||
    Object.keys(a).some(k => !['under', 'over', 'rough'].includes(k))
  )
    throw new Error('art must be {under: [...], over: [...], rough}');
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

/** Tone, graphic-transition style, frame label, speaker, camera and plate. */
function beatLayers(source, b, sb) {
  const out = {};
  const heading = source.heading ?? sb.heading;
  if (heading != null) {
    if (!['top', 'bottom'].includes(heading)) throw new Error('heading must be top or bottom');
    out.heading = heading;
  }
  if (source.textMotion != null) {
    if (!TEXT_MOTIONS.includes(source.textMotion)) throw new Error(`textMotion must be ${TEXT_MOTIONS.join(', ')}`);
    out.text_motion = source.textMotion;
  }
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
  if (source.camera != null) {
    const camera = typeof source.camera === 'string' ? { move: source.camera } : structuredClone(source.camera);
    if (
      !camera ||
      typeof camera !== 'object' ||
      Object.keys(camera).some(k => !['move', 'amount'].includes(k)) ||
      !CAMERA_MOVES.includes(camera.move ?? 'auto') ||
      (camera.amount != null && !unit(camera.amount))
    )
      throw new Error(`camera must be ${CAMERA_MOVES.join('|')} or {move, amount: 0–1}`);
    out.camera = camera;
  }
  if (source.plate != null) out.plate = plateSpec(source.plate, b.block);
  return out;
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
  if (plate.scrim != null && !unit(plate.scrim)) throw new Error('plate.scrim must be 0–1');
  if (plate.focus != null && !(Array.isArray(plate.focus) && plate.focus.length === 2 && plate.focus.every(unit)))
    throw new Error('plate.focus must be [x, y] from 0 to 1');
  if (plate.offset != null && !(Number.isFinite(plate.offset) && plate.offset >= 0))
    throw new Error('plate.offset must be nonnegative');
  if (['image', 'video', 'annotate'].includes(block) && (plate.side ?? 'full') !== 'full')
    throw new Error('media blocks already show media; use a full plate or a canvas');
  return plate;
}

function checkNarration(b, frame, captions, report) {
  const soft = report.draft ? report.warnings : report.errors;
  if (b.vo?.estimated) soft.push(`${b.id}: narration is estimated; record/import audio or use --draft.`);
  if (b.vo && (b.vo.start < b.start - 1e-3 || b.vo.end > b.end + frame))
    throw new Error('Narration crosses beat bounds; remove the forced duration/negative lead.');
  if (b.block === 'kinetic' && !b.vo?.words?.length) throw new Error('kinetic needs narration and word timestamps.');
  if ((b.block === 'kinetic' || captions) && b.vo) {
    glyphCheck(b.vo.text, `${b.id}.vo (shown as ${b.block === 'kinetic' ? 'kinetic text' : 'captions'})`, m => {
      throw new Error(m);
    });
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
  if (next === 'cut') return 'none';
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
 * Consecutive canvas beats that name the same `world` are one continuous drawing: each beat
 * inherits everything drawn before (on its original clock, so loops and exits carry on), the
 * cut between them is invisible, and the camera travels from the last view to the new one.
 */
function linkWorlds(beats, sb, timing, { warnings }) {
  const fps = timing.fps;
  for (let i = 1; i < beats.length; i++) {
    const a = beats[i - 1],
      b = beats[i];
    const name = b.block === 'canvas' && b.props.world;
    if (!name || a.block !== 'canvas' || a.props.world !== name) continue;
    const shift = (b.start_frame - a.start_frame) / fps;
    const carried = [],
      own = [];
    for (const el of a.props.elements) (el.carried ? carried : own).push(el);
    b.props.elements = [
      ...carried.map(g => ({ ...g, shift: g.shift + shift })),
      ...(own.length ? [{ type: 'group', carried: true, at: 0, dur: 0, enter: 'none', shift, children: own }] : []),
      ...b.props.elements,
    ];
    const src = sb.beats[timing.beats[i].index];
    if (src.transition && src.transition !== 'cut')
      warnings.push(
        `${b.id}: continues world "${name}"; a ${src.transition} transition breaks the continuous camera, use cut.`,
      );
    else {
      b.transition = 'cut';
      a.exit = 'none';
    }
    if (!b.props.viewFrom && JSON.stringify(a.props.view) !== JSON.stringify(b.props.view)) {
      b.props.viewFrom = a.props.view;
      // Travel with the first new drawing, so the camera arrives as the next stop appears.
      const firstNew = Math.min(...b.props.elements.filter(el => !el.carried).map(el => el.at ?? 0));
      b.props.viewAt ??= Number.isFinite(firstNew) ? Math.max(0, firstNew - 0.25) : 0;
      b.props.viewDur ??= 1.2;
      b.settle_seconds = Math.max(b.settle_seconds, (b.props.viewAt ?? 0) + b.props.viewDur);
    }
    for (const [beat, s] of [
      [a, sb.beats[timing.beats[i - 1].index]],
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
      warnings.push(
        `${a.id} → ${next.id}: no room for the ${next.transition} transition (${(seconds - earliest).toFixed(2)}s after the last word, needs ${cover[0]}s); using a fade. Add tail or shorten the line.`,
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
