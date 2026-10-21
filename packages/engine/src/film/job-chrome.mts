import type { ResolvedStoryboard as Storyboard } from '../engine/domain.mjs';
import type { JobReport, JobBeat, FrameChromeInput } from './types.mjs';

import { glyphCheck } from './glyphs.mjs';

export function frameChrome(
  sb: Storyboard,
  beats: JobBeat[],
  { errors }: JobReport,
): FrameChromeInput | null {
  if (sb.frame == null || sb.frame === false) return null;
  const fail = (m: string) => {
    errors.push(m);
  };
  const f = sb.frame === true ? {} : sb.frame;
  if (
    !f ||
    typeof f !== 'object' ||
    Array.isArray(f) ||
    Object.keys(f).some(
      (k) => !['brand', 'left', 'right', 'label', 'progress'].includes(k),
    )
  ) {
    fail('frame must be true or {brand, left, right, label, progress}.');
    return null;
  }
  checkFrameFields(f, beats, fail);
  return { ...f };
}

function checkFrameFields(
  f: FrameChromeInput,
  beats: JobBeat[],
  fail: (message: string) => void,
): void {
  for (const k of ['brand', 'left', 'right'] as const)
    if (f[k] != null && (typeof f[k] !== 'string' || f[k].length > 40))
      fail(`frame.${k} must be text up to 40 characters.`);
  for (const k of ['label', 'progress'] as const)
    if (f[k] != null && typeof f[k] !== 'boolean')
      fail(`frame.${k} must be true or false.`);
  if (f.brand) glyphCheck(f.brand, 'frame.brand', fail, 'serif-italic');
  for (const k of ['left', 'right'] as const)
    if (typeof f[k] === 'string')
      glyphCheck(f[k].toUpperCase(), `frame.${k}`, fail, 'mono');
  for (const b of beats)
    if (b.label)
      glyphCheck(b.label.toUpperCase(), `${b.id}.label`, fail, 'mono');
}
