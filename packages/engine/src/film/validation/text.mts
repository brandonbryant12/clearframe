import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';
import { headline } from './helpers.mjs';

export const validateTitle: BlockValidator = headline;

export const validateStatement: BlockValidator = headline;

export const validateEndcard: BlockValidator = headline;

export const validateQuote: BlockValidator = headline;

export const validateCallout: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.icon(p.icon, 'icon');
  headline(p, h);
};

export const validateChapter: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => h.required(p.title, 'title');

export const validateHighlight: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.phrases, 'phrases', 1, 4);
  p.phrases = p.phrases.map((ph, i) => {
    const o = typeof ph === 'string' ? { text: ph } : ph;
    h.keys(o, ['text', 'say'], `phrases[${i}]`);
    h.text(o.text, 'phrase', 60);
    if (h.findPhrase(p.text, o.text) < 0)
      h.fail(`phrase "${o.text}" must be whole words from the text`);
    return o;
  });
  headline(p, h);
};

export const validateCompare: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  for (const key of ['left', 'right'] as const) {
    if (!p[key]) h.fail(`${key} is required`);
    h.keys(p[key], ['title', 'items'], key);
    h.text(p[key].title, key, 48);
    h.list(p[key].items, `${key}.items`, 1, 4);
    p[key].items.forEach((x) => h.text(x, 'item', 75));
  }
};

export const validateEquation: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => h.required(p.expression, 'expression');

const invalidObject = (value: unknown): boolean =>
  value != null && (typeof value !== 'object' || Array.isArray(value));

const invalidList = (value: unknown): boolean =>
  value != null && !Array.isArray(value);

export const validateStage: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  for (const key of [
    'actors',
    'links',
    'events',
    'under',
    'elements',
    'over',
  ] as const)
    if (invalidList(p[key])) h.fail(`${key} must be a list`);
  for (const key of ['code', 'ground', 'camera', 'motion'] as const)
    if (invalidObject(p[key])) h.fail(`${key} must be an object`);
  if (
    p.shutter != null &&
    !(Number.isFinite(p.shutter) && p.shutter >= 0 && p.shutter <= 1)
  )
    h.fail('shutter must be 0–1');
  if (
    p.samples != null &&
    !(Number.isInteger(p.samples) && p.samples >= 1 && p.samples <= 32)
  )
    h.fail('samples must be 1–32');
  if (p.z != null && !['under', 'over'].includes(p.z))
    h.fail('z must be under or over');
  if (p.support != null)
    h.fail('a stage draws its own picture; put supporting words in an element');
};
