// Sound that follows the picture: cues placed on the job's own visual events, so hits land on
// the frame they belong to. Each block's events come from registry.mjs.
import { rules } from './registry.mjs';

const LEVELS = { subtle: 0.6, normal: 1, punchy: 1.35 };

/** `sfx`: true/'normal', 'subtle', 'punchy', or false/'off'. */
export function soundDesign(job, sfx) {
  const level = sfx === true ? 'normal' : sfx;
  if (!LEVELS[level]) return [];
  const cues = [];
  const add = (name, t, volume, weight = 1) => {
    if (t >= 0 && t < job.frames / job.fps) cues.push({ name, t, volume: volume * LEVELS[level], weight });
  };
  for (const b of job.beats) {
    const start = b.start_frame / job.fps,
      spec = rules(b.block);
    const t = { start, cue: start + b.cue_seconds, level };
    if (['panel', 'iris', 'whip'].includes(b.transition) && start > 0) add('whoosh', start - 0.3, 0.3, 3);
    spec.sounds?.(b, add, t);
    if (spec.tock && level !== 'subtle')
      for (const it of b.props.items ?? b.props.nodes ?? []) if (it.at != null) add('tock', start + it.at, 0.14, 0);
    if (b.tone && level === 'punchy') add('thud', start + 0.02, 0.25, 2);
    let pops = 0;
    for (const el of [...(b.block === 'canvas' ? b.props.elements : []), ...(b.art?.over ?? [])]) {
      if (el.count) add('thud', start + el.at + el.count.dur, 0.28, 3);
      else if (
        (el.enter === 'pop' || (el.enter == null && ['circle', 'icon'].includes(el.type))) &&
        pops < (level === 'punchy' ? 8 : 4)
      ) {
        add('pop', start + el.at, 0.16, 0);
        pops++;
      }
    }
    if (level === 'punchy' && b.block === 'kinetic' && b.props.mode === 'stack') {
      const keys = new Set((b.props.emphasis ?? []).flatMap(e => e.toLowerCase().split(/\s+/)));
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
