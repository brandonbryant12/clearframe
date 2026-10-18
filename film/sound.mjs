// Sound that follows the picture: cues placed on the job's own visual events, so hits land on
// the frame they belong to. Each block's events come from registry.mjs.
import { rules } from './registry.mjs';

const LEVELS = { subtle: 0.6, normal: 1, punchy: 1.35 };

/**
 * The beat time at which an element's own moment `at` is first on screen, inverting the canvas
 * clock (scene/native/src/blocks/canvas.rs): each element steps `fps` times a second (it shows the
 * moment on its next drawing), and a group runs its children `shift` seconds ahead (a world beat
 * carrying earlier drawings forward). `clock` lists those steps from the beat inward.
 */
export function beatTime(at, clock) {
  let t = at,
    moved = false;
  for (const step of [...clock].reverse()) {
    if (step.shift) (t -= step.shift), (moved = true);
    if (step.fps > 0) (t = Math.ceil(t * step.fps - 1e-6) / step.fps), (moved = true);
  }
  // An element on the beat's own continuous clock keeps its authored time to the bit.
  return moved ? Math.round(t * 1e6) / 1e6 : at;
}

/** `sfx`: true/'normal', 'subtle', 'punchy', or false/'off'. */
export function soundDesign(job, sfx) {
  const level = sfx === true ? 'normal' : sfx;
  if (!LEVELS[level]) return [];
  const cues = [];
  // Nothing fires on the first frames: a film opens on its picture, not on a click.
  const add = (name, t, volume, weight = 1) => {
    if (t >= 0.2 && t < job.frames / job.fps) cues.push({ name, t, volume: volume * LEVELS[level], weight });
  };
  for (const b of job.beats) {
    const start = b.start_frame / job.fps,
      spec = rules(b.block);
    const t = { start, cue: start + b.cue_seconds, level };
    // No automatic swells, drones or hits: trailer punctuation under a benefits or policy film
    // reads as a sales pitch. An author who wants one names it (`sound` on an element or key).
    // Only a fast flight whooshes; a slow creep is felt, not heard.
    const flight = b.block === 'canvas' && b.props.dolly?.find(k => Math.abs(k.z) / Math.max(0.1, k.dur ?? 1.2) > 0.8);
    if (flight) add('whoosh', start + flight.at, 0.16, 1);
    spec.sounds?.(b, add, t);
    if (spec.tock && level !== 'subtle')
      for (const it of b.props.items ?? b.props.nodes ?? []) if (it.at != null) add('tock', start + it.at, 0.14, 0);
    if (b.tone && level === 'punchy') add('thud', start + 0.02, 0.25, 2);
    // A world camera travelling to its next stop.
    if (b.block === 'canvas' && b.props.viewFrom && (b.props.viewDur ?? 1.2) <= 2.5)
      add('whoosh', start + (b.props.viewAt ?? 0), 0.18, 2);
    // Sounds the author placed on an element (as it enters) or on its keys (as it moves): a click
    // as the pointer presses, a whoosh as the email is yanked out. Heavier than the automatic ones.
    // Each plays at its moment on the renderer's clock (beatTime): on a stepped element's next
    // drawing, and never for a drawing a world beat carries forward already finished. An unstepped,
    // unshifted element keeps its authored time exactly. A moment no frame of the beat shows (a
    // stepped drawing that would arrive after the cut) is silent rather than heard in the next scene.
    // Precision is the film frame's, as for every sound: a cue may lead its first frame by under 1/fps.
    const authored = (list, outer = [], inherited = 0, stagger = 0) =>
      (list ?? []).forEach((el, i) => {
        const own = el.at ?? (outer.length ? inherited + i * stagger : null);
        const clock = [...outer, { fps: el.fps }];
        const hit = (v, at) => {
          const t = at == null ? null : beatTime(at, clock);
          if (t != null && t >= 0 && Math.ceil(t * job.fps - 1e-6) < b.frames)
            add(typeof v === 'string' ? v : v.name, start + t, typeof v === 'object' && v.volume != null ? v.volume : 0.3, 4);
        };
        if (el.sound != null) hit(el.sound, own);
        for (const k of el.keys ?? []) if (k.sound != null) hit(k.sound, k.at);
        // A mark's sound as it lands; a stamp is pressed with a thud (it sets down in 0.2 s).
        for (const m of el.marks ?? []) {
          const v = m.sound ?? (m.style === 'stamp' ? 'thud' : false);
          if (v !== false) hit(v, m.at + (m.style === 'stamp' ? 0.15 : 0));
        }
        if (el.type === 'group') authored(el.children, [...clock, { shift: el.shift ?? 0 }], el.at ?? 0, el.stagger ?? 0);
      });
    if (b.block === 'canvas') authored(b.props.elements);
    let grows = 0;
    for (const el of [...(b.block === 'canvas' ? b.props.elements : []), ...(b.art?.over ?? [])]) {
      if (el.type === 'text' && el.count) add('thud', start + el.at + el.count.dur, 0.28, 3);
      // A bar growing into place lands with a soft tock, one per value.
      // A chart landing gets one soft tock, on its first bar: a burst of ticks is noise.
      else if (el.type === 'rect' && ['grow', 'grow-x', 'grow-y'].includes(el.enter) && grows < 1) {
        add('tock', start + el.at + (el.dur ?? 0.6) * 0.8, 0.12, 0);
        grows++;
      }
      // Arrivals are silent: a bloop on every icon and dot made films sound like a phone game.
    }
    if (level === 'punchy' && b.block === 'kinetic' && b.props.mode === 'stack') {
      const keys = new Set([].concat(b.props.emphasis ?? []).flatMap(e => String(e).toLowerCase().split(/\s+/)));
      for (const w of b.words)
        if (keys.has(w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))) add('tick', start + w.start, 0.2, 1);
    }
  }
  // Keep the heavier of two cues closer than 0.16 s, so hits never smear together.
  cues.sort((a, b) => a.t - b.t);
  const kept = [];
  for (const c of cues) {
    const last = kept.at(-1);
    if (last && c.t - last.t < 0.16) {
      if (c.weight > last.weight) kept[kept.length - 1] = c;
      continue;
    }
    kept.push(c);
  }
  return kept.map(({ weight, ...c }) => c);
}
