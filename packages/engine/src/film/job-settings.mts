import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport } from './types.mjs';

import { textureValue, type FilmSettings } from './job-types.mjs';

import { messageOf } from './guards.mjs';
import { CANVASES, FRAME_RATES, BACKDROPS, palette } from './catalog.mjs';

import { TEXT_MOTIONS, retired } from './constants.mjs';

import { typeById } from './library.mjs';
import { voiceOf } from './type.mjs';

import { validMotion, unit, lensSpec } from './job-lens.mjs';

// ------------------------------------------------------------------ film

export function filmSettings(
  sb: Storyboard,
  timing: Timing,
  { errors }: JobReport,
): FilmSettings {
  if (!CANVASES.some(([w, h]) => w === timing.width && h === timing.height))
    errors.push(
      'Native canvas must be landscape, vertical, square, portrait, or 640×360.',
    );
  if (!FRAME_RATES.includes(timing.fps))
    errors.push(`Native fps must be ${FRAME_RATES.join(', ')}.`);
  const motion = { preset: 'gentle', intensity: 0.65, ...sb.motion };
  if (!validMotion(motion))
    errors.push('motion requires a known preset and intensity from 0 to 1.');
  const vertical = timing.height > timing.width;
  if (
    sb.captions != null &&
    ![true, false, 'auto', 'off', 'pop'].some((value) => value === sb.captions)
  )
    errors.push('captions must be true, false, auto, off or pop.');
  const backdrop = sb.backdrop ?? 'none';
  if (!BACKDROPS.includes(backdrop))
    errors.push(
      retired('backdrop', backdrop) ??
        `Native backdrop must be ${BACKDROPS.join(', ')}.`,
    );
  const texture = sb.texture ?? null;
  checkTexture(texture, errors);
  if (sb.pacing.outro)
    errors.push(
      'Use an endcard beat instead of pacing.outro so every output frame has an authored scene.',
    );
  try {
    lensSpec(sb.lens);
  } catch (e) {
    errors.push(messageOf(e));
  }
  const textMotion = sb.textMotion ?? 'lines';
  if (!TEXT_MOTIONS.includes(textMotion))
    errors.push(`textMotion must be ${TEXT_MOTIONS.join(', ')}.`);
  // The type voice: display family and emphasis for titles, statements, chapters, endcards
  // and kinetic text, resolved here so the renderer never reads the library.
  let type = null;
  try {
    type = voiceOf(sb.type, sb.type != null ? typeById(sb.type) : null);
  } catch (e) {
    errors.push(messageOf(e));
  }
  return {
    textMotion,
    type,
    theme: palette(sb.theme ?? 'paper'),
    motion,
    vertical,
    // Captions are on for any narrated film unless it opts out: most people watch muted.
    captions:
      sb.captions === true ||
      sb.captions === 'pop' ||
      ((sb.captions ?? 'auto') === 'auto' && sb.beats.some((b) => b.vo)),
    captionStyle: sb.captions === 'pop' ? 'pop' : 'standard',
    backdrop,
    texture: textureValue(texture),
  };
}

function checkTexture(texture: unknown, errors: string[]): void {
  const textureOk =
    texture == null ||
    (typeof texture === 'string' &&
      ['grain', 'vignette', 'film', 'none'].includes(texture)) ||
    (typeof texture === 'object' &&
      !Array.isArray(texture) &&
      Object.entries(texture).every(([k, v]) =>
        k === 'animate'
          ? typeof v === 'boolean'
          : ['grain', 'vignette'].includes(k) && unit(v),
      ));
  if (!textureOk)
    errors.push(
      'texture must be grain, vignette, film, none or {grain: 0–1, vignette: 0–1, animate}.',
    );
}
