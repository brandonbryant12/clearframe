// Storyboard + prepared job → the scene plan (build/native/plan.json, `clearframe.scene` v1).
//
// Native layers come from three places, all compiled by the same stage recipes:
//   - a `stage` block: the beat's picture is a native stage (the block layer keeps its
//     heading, source line, captions, speaker tag and transitions);
//   - a beat's `stage` field: native layers under or over any block (`z: under|over`);
//   - the film's `stages`: a stage spanning beats `from`..`to`, whose actors keep their state
//     across the cuts between them.
// Every time is resolved here (spoken cues included) and every media file is staged under its
// content hash, so the engine only evaluates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compileStage } from './recipes.mjs';
import { findWord } from '../engine/lib/timing.mjs';
import { ENTRANCE } from '../fframes/constants.mjs';

export const PLAN_KIND = 'clearframe.scene';
export const PLAN_VERSION = 1;
const NATIVE_TYPES = ['rect', 'circle', 'ellipse', 'line', 'path', 'poly', 'text', 'icon', 'image', 'group', 'particles', 'spotlight', 'video', 'shader', 'code', 'connector'];
const BLOCK_ONLY = ['rough', 'print', 'mosaic', 'morph', 'solid', 'meter'];
const STAGE_HEADING = ['title', 'kicker', 'source', 'support', 'land'];

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

/** Walk elements (groups included). */
function each(list, fn) {
  for (const el of list ?? []) {
    fn(el);
    if (el?.type === 'group') each(el.children, fn);
  }
}

/** Resolve `say` (and its relatives) to layer seconds, in place. */
function resolveTimes(list, cue, where) {
  each(list, el => {
    if (!el || typeof el !== 'object') throw new Error(`${where}: elements are objects`);
    if (!NATIVE_TYPES.includes(el.type)) throw new Error(`${where}: ${el.id ?? el.type ?? 'element'} has type ${JSON.stringify(el.type)}; native stages draw ${NATIVE_TYPES.join(', ')}`);
    for (const k of BLOCK_ONLY)
      if (el[k] != null || el.loop?.type === 'level')
        throw new Error(`${where}: ${el.id ?? el.type} uses ${el[k] != null ? k : 'loop level'}, which the canvas block draws; native stages do not. Put it in canvas/art, or remove it.`);
    if (el.say != null) {
      el.at = Math.max(0, cue(el.say) - (el.type === 'text' ? 0.2 : 0));
      delete el.say;
    }
    if (el.exitSay != null) {
      el.exitAt = cue(el.exitSay);
      delete el.exitSay;
    }
    for (const k of el.keys ?? [])
      if (k.say != null) {
        k.at = cue(k.say);
        delete k.say;
      }
    if (el.keys) el.keys.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    for (const o of [el.along, el.shine])
      if (o && typeof o === 'object' && o.say != null) {
        o.at = cue(o.say);
        delete o.say;
      }
  });
}

/** Seconds by which everything in a layer has arrived (entrances, travel, keys). */
function settleOf(list, entrance) {
  let t = 0;
  each(list, el => {
    const at = el.at ?? 0;
    t = Math.max(t, at + (el.dur ?? entrance));
    for (const k of el.keys ?? []) t = Math.max(t, (k.at ?? 0) + (k.dur ?? 0.6));
    if (el.along) t = Math.max(t, (el.along.at ?? at) + (el.along.dur ?? 1.5));
    if (el.type === 'code') for (const st of el.steps ?? []) t = Math.max(t, (st.at ?? 0) + (el.dur ?? 0.7));
    if (el.count) t = Math.max(t, at + (el.count.dur ?? 1.2));
  });
  return t;
}

function probeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Cannot probe ${file}`);
  return Number(JSON.parse(r.stdout).format?.duration);
}

/**
 * Compile the plan. `ctx`: {root, sb, timing, job, stage(rel, where) → {file, key}, assetFile(ref, kind, where) → rel}.
 * Returns {plan, warnings, footage, provenance, settle}.
 */
export function compilePlan({ root, sb, timing, job, stage, assetFile }, { rough = false } = {}) {
  const fps = job.fps;
  const frame = { width: timing.width * (1080 / Math.min(timing.width, timing.height)), height: timing.height * (1080 / Math.min(timing.width, timing.height)) };
  const warnings = [];
  const footage = [];
  const provenance = [];
  const layers = [];
  const settle = {};
  const jobBeat = id => job.beats.find(b => b.id === id);
  const timingBeat = id => timing.beats.find(b => b.id === id);
  const sbBeat = id => sb.beats.find(b => b.id === id);

  const add = ({ id, spec, start, frames, beat, z, cue, where, fade }) => {
    const end = frames / fps;
    const { elements, camera } = compileStage(spec, { cue, end, where, frame, staged: p => provenance.push({ layer: id, ...p }) });
    resolveTimes(elements, cue, where);
    each(elements, el => {
      if (el.at != null && el.at > end - 1 / fps + 1e-7)
        throw new Error(`${where}: ${el.id ?? el.type} is cued at ${el.at.toFixed(2)} s, after the stage ends at ${end.toFixed(2)} s; move the cue or extend the beat.`);
      if (el.type === 'image' || el.type === 'video') {
        const rel = el.asset || el.file?.includes('/') || el.file?.includes('.') ? assetFile(el, el.type === 'video' ? 'clip' : 'image', where) : null;
        if (!rel) throw new Error(`${where}: ${el.id ?? el.type} needs asset (an asset id) or file (a project path)`);
        const { file, key } = stage(rel, where);
        el.file = key;
        delete el.asset;
        if (el.type === 'video') {
          const duration = probeDuration(file);
          // Footage is shown from its entrance to its exit (or the stage's end).
          const shown = Math.max(0, Math.min(el.exitAt ?? end, end) - (el.at ?? 0)) * (el.rate ?? 1);
          const need = (el.offset ?? 0) + shown;
          if (!el.hold && need > duration + 1 / fps + 1e-6)
            throw new Error(`${where}: footage ${rel} is ${duration.toFixed(2)} s but the stage shows ${need.toFixed(2)} s of it (offset ${el.offset ?? 0} s); trim the shot or use a longer clip. Footage never loops, and freezes only with hold: true.`);
          if (el.hold && need > duration + 1 / fps) warnings.push(`${where}: ${rel} holds its last frame for ${(need - duration).toFixed(2)} s (hold: true).`);
          el.duration = duration;
          footage.push({ beat: beat ?? id, index: beat ? job.beats.findIndex(b => b.id === beat) : -1, source: rel, offset: el.offset ?? 0, seconds: Math.min(shown, duration) });
        }
      }
    });
    const motion = beat ? jobBeat(beat).motion : job.motion;
    const shutter = spec.shutter ?? 0;
    const layer = {
      id,
      start,
      frames,
      ...(beat ? { beat } : {}),
      z,
      fade,
      ...(camera ? { camera } : {}),
      shutter,
      samples: shutter > 0 ? (spec.samples ?? 8) : 0,
      motion,
      elements,
    };
    if (beat) settle[beat] = Math.max(settle[beat] ?? 0, settleOf(elements, ENTRANCE[motion?.preset ?? 'gentle']));
    layers.push(layer);
  };

  const beatCue = b => (value, fallback = 0) => {
    if (value == null) return fallback;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value >= b.dur) throw new Error(`cue ${value} s lies outside the beat (0–${b.dur.toFixed(2)} s)`);
      return value;
    }
    const t = findWord(b.vo?.words ?? [], String(value));
    if (t == null) throw new Error(`spoken cue "${value}" is not in ${b.id}'s narration`);
    return Math.max(0, t - b.start);
  };
  // Fade a beat's native layer with the beat's own entrance and exit (dissolves are composited).
  const fadeFor = jb => {
    const entrance = ENTRANCE[jb.motion?.preset ?? 'gentle'];
    return [['fade', 'rise', 'zoom', 'wipe', 'push'].includes(jb.transition) ? entrance : 0, ['fade', 'zoom', 'push'].includes(jb.exit) ? 0.32 : 0];
  };

  for (const tb of timing.beats) {
    const source = sbBeat(tb.id);
    const jb = jobBeat(tb.id);
    if (!jb) continue;
    const where = tb.id;
    if (tb.block === 'stage') {
      const spec = Object.fromEntries(Object.entries(source.props ?? {}).filter(([k]) => !STAGE_HEADING.includes(k)));
      add({ id: `${tb.id}/stage`, spec, start: jb.start_frame, frames: jb.frames, beat: tb.id, z: spec.z ?? 'under', cue: beatCue(tb), where: `${where}.props`, fade: fadeFor(jb) });
    }
    const extra = source.stage == null ? [] : Array.isArray(source.stage) ? source.stage : [source.stage];
    extra.forEach((spec, i) => {
      if (!['under', 'over', undefined].includes(spec?.z)) throw new Error(`${where}.stage: z is under or over`);
      add({ id: `${tb.id}/stage-${i}`, spec, start: jb.start_frame, frames: jb.frames, beat: tb.id, z: spec.z ?? 'over', cue: beatCue(tb), where: `${where}.stage`, fade: fadeFor(jb) });
    });
  }
  // Film stages: one layer across beats, on its own clock from the first beat's start.
  for (const [i, s] of (sb.stages ?? []).entries()) {
    const where = `stages[${i}]`;
    if (!s?.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(s.id)) throw new Error(`${where}: needs an id (a slug)`);
    const [a, b] = [jobBeat(s.from), jobBeat(s.to ?? s.from)];
    if (!a || !b) throw new Error(`${where}: from and to must name beats`);
    if (b.start_frame < a.start_frame) throw new Error(`${where}: to comes before from`);
    const start = a.start_frame,
      frames = b.start_frame + b.frames - start;
    const t0 = start / fps;
    const span = timing.beats.filter(x => x.start >= timingBeat(s.from).start - 1e-9 && x.end <= timingBeat(s.to ?? s.from).end + 1e-9);
    const cue = (value, fallback = 0) => {
      if (value == null) return fallback;
      if (typeof value === 'number') {
        if (!(value >= 0 && value < frames / fps)) throw new Error(`cue ${value} s lies outside the stage`);
        return value;
      }
      if (typeof value === 'object' && value.beat) {
        const tb = timingBeat(value.beat);
        if (!span.includes(tb)) throw new Error(`cue names beat ${value.beat}, outside the stage`);
        return tb.start - t0 + (value.say != null ? beatCue(tb)(value.say) : (value.at ?? 0));
      }
      for (const tb of span) {
        const t = findWord(tb.vo?.words ?? [], String(value));
        if (t != null) return Math.max(0, t - t0);
      }
      throw new Error(`spoken cue "${value}" is not in the stage's narration (${span.map(x => x.id).join(', ')})`);
    };
    const { id, from, to, ...spec } = s;
    add({ id: `stage:${id}`, spec, start, frames, z: spec.z ?? 'under', cue, where, fade: [0, 0] });
  }
  const plan = {
    kind: PLAN_KIND,
    version: PLAN_VERSION,
    format: { width: job.width, height: job.height, fps, frames: job.frames },
    job: 'job.json',
    media: 'media',
    layers,
    inputs: { provenance, footage: footage.map(f => ({ source: f.source, offset: f.offset, seconds: f.seconds })) },
  };
  return { plan, warnings, footage, provenance, settle, hash: sha256(JSON.stringify(plan)) };
}

export function writePlan(dir, plan) {
  const file = path.join(dir, 'plan.json');
  fs.writeFileSync(file, JSON.stringify(plan) + '\n');
  return file;
}
