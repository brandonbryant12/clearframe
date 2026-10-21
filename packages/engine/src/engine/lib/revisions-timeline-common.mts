import type { NativeJob } from '../../film/types.mjs';

import { isRecord } from './errors.mjs';

import type { Storyboard, Beat } from '../domain.mjs';

export const round = (n: number, d = 3): number =>
  Math.round(n * 10 ** d) / 10 ** d;

export const PRINT_SCHEME = 2;

// Keys of a beat that make its picture (a "keep picture" covers these and the media they use).
export const PICTURE_KEYS = [
  'block',
  'props',
  'art',
  'plate',
  'camera',
  'tone',
  'transition',
  'exit',
  'motion',
  'textMotion',
  'heading',
  'label',
  'lens',
  'transitionColor',
  'transitionOrigin',
  'placeholder',
];

// Film settings that make the look (a "keep look" covers these).
export const LOOK_KEYS = [
  'format',
  'theme',
  'motion',
  'transition',
  'backdrop',
  'chrome',
  'captions',
  'treatment',
  'frame',
  'heading',
  'textMotion',
  'texture',
  'lens',
  'speakers',
];

export const SOUND_KEYS = ['music', 'mix', 'sfx'];

export const JOB_FILM_KEYS = [
  'width',
  'height',
  'fps',
  'theme',
  'motion',
  'backdrop',
  'chrome',
  'captions',
  'caption_style',
  'texture',
  'text_motion',
  'frame',
];

export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function elementIds(beat: Partial<Beat>): string[] {
  const ids: string[] = [];
  const walk = (items: unknown): void =>
    list(items).forEach((el) => {
      if (!isRecord(el)) return;
      if (typeof el.id === 'string') ids.push(el.id);
      walk(el.children);
    });
  walk(beat.props?.elements);
  walk(beat.art?.under);
  walk(beat.art?.over);
  return [...new Set(ids)];
}

/** Staged media keys (content hashes) a prepared job beat draws. */
export function mediaKeys(jb: unknown): string[] {
  const keys = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isRecord(v))
      for (const [k, x] of Object.entries(v)) {
        if (
          k === 'file' &&
          typeof x === 'string' &&
          /^[0-9a-f]{16}\.[a-z0-9]+$/.test(x)
        )
          keys.add(x);
        else walk(x);
      }
  };
  walk(jb);
  return [...keys].sort();
}

/** The named fields of an object that are set. */
export function pick(
  obj: Partial<Beat> | NativeJob | Omit<Storyboard, 'beats'> | null | undefined,
  keys: string[],
): Record<string, unknown> {
  const fields = new Map<string, unknown>(obj ? Object.entries(obj) : []);
  return Object.fromEntries(
    keys
      .filter((k) => fields.get(k) !== undefined)
      .map((k): [string, unknown] => [k, fields.get(k)]),
  );
}

/**
 * A prepared beat's times are relative, but they come from absolute times rounded to the
 * millisecond, so the same beat at a new position differs by fractions of a millisecond.
 * Fingerprints round to 10 ms to classify "moved" honestly; a moved beat is still reported
 * as moved (and re-checked), never as unchanged or reusable.
 */
export const settle = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(settle);
  if (isRecord(v))
    return Object.fromEntries(
      Object.entries(v).map(([k, x]): [string, unknown] => [k, settle(x)]),
    );
  return typeof v === 'number' && !Number.isInteger(v)
    ? Math.round(v * 100) / 100
    : v;
};
