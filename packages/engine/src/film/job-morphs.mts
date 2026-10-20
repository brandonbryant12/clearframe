import { morphElement } from './job-morph-element.mjs';
import { morphTransition } from './job-morph-transition.mjs';
import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, JobBeat, CanvasElement } from './types.mjs';

import { messageOf } from './guards.mjs';

import { linkSlices } from './job-slices.mjs';

/**
 * Morph by id: an element whose id also appears in the previous beat animates from that
 * element's geometry and colour across the cut, like Magic Move.
 */
export function linkMorphs(
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  { warnings, errors }: JobReport,
) {
  const layers = (b: JobBeat): CanvasElement[] => [
    ...(b.block === 'canvas' ? (b.props.elements ?? []) : []),
    ...(b.art?.under ?? []),
    ...(b.art?.over ?? []),
  ];
  // The first beat has nothing before it to come out of: its slices arrive as authored.
  if (beats.length) for (const el of layers(beats[0])) delete el.morphFrom;
  for (let i = 1; i < beats.length; i++) {
    const prev = new Map(
      layers(beats[i - 1]).flatMap((el) =>
        el.id ? [[el.id, el] as const] : [],
      ),
    );
    let linked = false;
    try {
      linked = linkSlices(beats[i], layers(beats[i]), prev) || linked;
    } catch (e) {
      errors.push(`${beats[i].id}: ${messageOf(e)}`);
    }
    for (const el of layers(beats[i])) {
      const from = el.id && prev.get(el.id);
      if (!from) continue;
      morphElement(el, from, beats[i], warnings);
      linked = true;
    }
    if (!linked) continue;
    morphTransition(beats[i - 1], beats[i], i, sb, timing, warnings);
  }
}
