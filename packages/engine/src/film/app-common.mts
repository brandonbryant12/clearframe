import type { Cued, When } from './app-contracts.mjs';
export const APP_FIELDS = [
  'x',
  'y',
  'w',
  'h',
  'device',
  'title',
  'tabs',
  'heading',
  'open',
  'upload',
  'fields',
  'button',
  'pages',
  'size',
];
export const TIMING = [
  'id',
  'at',
  'say',
  'cue',
  'exitCue',
  'after',
  'dur',
  'enter',
  'exit',
  'exitAt',
  'exitSay',
  'exitAfter',
  'keys',
  'scale',
  'rotate',
  'origin',
  'opacity',
  'note',
  'z',
  'depth',
  'unfinished',
];

export const slug = (t: unknown): string =>
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const round = (v: number): number => Math.round(v);
export function when(spec: Cued | null | undefined, extra = 0): When | null {
  if (spec?.say != null)
    return { say: spec.say, after: (spec.after ?? 0) + extra };
  if (spec?.at != null) return { at: spec.at + extra };
  return null;
}
