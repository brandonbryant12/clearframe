import type {
  ResolvedStoryboard as Storyboard,
  Beat as StoryboardBeat,
} from '../engine/domain.mjs';
import type { JobReport, BeatLayers, PlateInput } from './types.mjs';

import { TREATMENTS } from './canvas.mjs';
import { PLATE_SIDES, DRIFTS } from './constants.mjs';

import { unit } from './job-lens.mjs';

export function plateSpec(input: PlateInput, block: string | null): PlateInput {
  const plate = structuredClone(input);
  if (!plate || typeof plate !== 'object' || Array.isArray(plate))
    throw new Error('plate must be an object');
  for (const k of Object.keys(plate))
    if (
      ![
        'asset',
        'file',
        'side',
        'treatment',
        'drift',
        'scrim',
        'focus',
        'offset',
        'loop',
      ].includes(k)
    )
      throw new Error(`plate: unsupported field ${k}`);
  if (!plate.asset && !plate.file) throw new Error('plate needs asset or file');
  checkPlateStyle(plate);
  checkPlatePosition(plate, block);
  return plate;
}
/**
 * Footage carries its own camera motion: a plate's drift on top of it reads as shake, and
 * nothing moving inside the footage can be steadied by the native camera.
 */
export function footageDrift(
  source: StoryboardBeat,
  sb: Storyboard,
  out: BeatLayers,
  report: JobReport,
) {
  const drift = out.plate?.drift ?? 'in';
  if (!out.plate || drift === 'none') return;
  const plate = out.plate;
  const asset =
    plate.asset != null ? sb.assets?.find((a) => a.id === plate.asset) : null;
  if (
    asset?.kind === 'clip' ||
    /\.(mp4|mov|webm|m4v)$/i.test(out.plate.file ?? '')
  )
    report.warnings.push(
      `${source.id}: footage carries its own camera motion; plate drift ${drift} on top of it reads as shake. Set plate.drift: "none" for this beat, and ask the generator for a locked camera.`,
    );
}

function checkPlateStyle(plate: PlateInput): void {
  if (plate.side != null && !PLATE_SIDES.includes(plate.side))
    throw new Error(`plate.side must be ${PLATE_SIDES.join(', ')}`);
  if (plate.treatment != null && !TREATMENTS.includes(plate.treatment))
    throw new Error(`plate.treatment must be ${TREATMENTS.join(', ')}`);
  if (plate.drift != null && !DRIFTS.includes(plate.drift))
    throw new Error(`plate.drift must be ${DRIFTS.join(', ')}`);
  if (plate.loop != null && typeof plate.loop !== 'boolean')
    throw new Error('plate.loop must be boolean');
  if (plate.loop === true)
    throw new Error(
      'B-roll must cover the beat without looping; trim the scene, select a source range or provide a longer clip.',
    );
}

function checkPlatePosition(plate: PlateInput, block: string | null): void {
  if (plate.scrim != null && !unit(plate.scrim))
    throw new Error('plate.scrim must be 0–1');
  if (
    plate.focus != null &&
    !(
      Array.isArray(plate.focus) &&
      plate.focus.length === 2 &&
      plate.focus.every(unit)
    )
  )
    throw new Error('plate.focus must be [x, y] from 0 to 1');
  if (
    plate.offset != null &&
    !(Number.isFinite(plate.offset) && plate.offset >= 0)
  )
    throw new Error('plate.offset must be nonnegative');
  if (
    ['image', 'video', 'annotate'].includes(block ?? '') &&
    (plate.side ?? 'full') !== 'full'
  )
    throw new Error(
      'media blocks already show media; use a full plate or a canvas',
    );
}
