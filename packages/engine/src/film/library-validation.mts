import { validateType } from './type.mjs';
import { isList, isObject, isRecord } from './guards.mjs';
import type {
  JsonRecord,
  LibraryItemBase,
  LibraryKind,
  PaletteColors,
} from './types.mjs';

import {
  PALETTE_KEYS,
  isPaletteKey,
  type StoredItem,
} from './library-constants.mjs';
// ------------------------------------------------------------------ validation

const hex = (v: unknown): v is string =>
  typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
function luminance(color: string): number {
  const c = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function known(
  item: unknown,
  keys: string[],
  where: string,
): asserts item is JsonRecord {
  if (!isObject(item)) throw new Error(`${where} must be an object`);
  for (const k of Object.keys(item))
    if (!keys.includes(k) && k !== 'id' && k !== 'source')
      throw new Error(`${where}: unknown field "${k}"`);
}
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '';

interface LibraryLookup {
  items: (kind: LibraryKind) => LibraryItemBase[];
  palettes: () => Record<string, PaletteColors>;
}
export function createValidators({
  items,
  palettes,
}: LibraryLookup): Record<
  LibraryKind,
  (item: StoredItem, where: string) => void
> {
  return {
    directions(item, where) {
      known(
        item,
        [
          'order',
          'title',
          'when',
          'materials',
          'playbook',
          'treatment',
          'story',
          'picture',
          'pace',
          'rules',
        ],
        where,
      );
      for (const key of ['title', 'when', 'story', 'picture', 'pace'])
        if (!text(item[key])) throw new Error(`${where}: needs ${key}`);
      for (const key of ['materials', 'rules']) {
        const list = item[key];
        if (!isList(list) || !list.length || list.some((v) => !text(v)))
          throw new Error(
            `${where}: ${key} must be a nonempty list of strings`,
          );
      }
      for (const [key, kind] of [
        ['playbook', 'playbooks'],
        ['treatment', 'treatments'],
      ] as const)
        if (!items(kind).some((v) => v.id === item[key]))
          throw new Error(`${where}: unknown ${key} "${String(item[key])}"`);
    },
    palettes(item, where) {
      known(item, ['order', 'title', 'notes', 'colors'], where);
      const colors = item.colors;
      if (!isObject(colors))
        throw new Error(`${where}: needs colors {${PALETTE_KEYS.join(', ')}}`);
      for (const k of PALETTE_KEYS)
        if (!hex(colors[k]))
          throw new Error(`${where}: colors.${k} must be #rrggbb`);
      for (const k of Object.keys(colors))
        if (!isPaletteKey(k))
          throw new Error(`${where}: unknown colour "${k}"`);
      // Readability is part of the contract: text roles against the background.
      for (const [k, min] of [
        ['ink', 4.5],
        ['muted', 4.5],
        ['accent', 4.5],
        ['accent2', 3],
      ] as const) {
        const ratio = contrast(String(colors[k]), String(colors.bg));
        if (ratio < min)
          throw new Error(
            `${where}: ${k} has ${ratio.toFixed(2)}:1 contrast on bg; needs ${min}:1`,
          );
      }
    },
    treatments(item, where) {
      known(
        item,
        [
          'order',
          'title',
          'when',
          'film',
          'beats',
          'rules',
          'playbook',
          'playbooks',
          'variants',
        ],
        where,
      );
      if (item.variants != null) {
        if (!isList(item.variants) || !item.variants.length)
          throw new Error(`${where}: variants must be a non-empty list`);
        item.variants.forEach((v, i) => {
          known(v, ['name', 'film', 'beats'], `${where} variants[${i}]`);
          if (!text(v.name))
            throw new Error(`${where}: variants[${i}] needs a name`);
          const film = isObject(v.film) ? v.film : null;
          if (
            film?.theme != null &&
            !Object.hasOwn(palettes(), String(film.theme))
          )
            throw new Error(
              `${where}: variants[${i}].film.theme "${String(film.theme)}" is not a palette`,
            );
          if (
            film?.type != null &&
            !items('types').some((t) => t.id === film.type)
          )
            throw new Error(
              `${where}: variants[${i}].film.type "${String(film.type)}" is not a type voice`,
            );
        });
      }
      if (!item.title || !item.when)
        throw new Error(`${where}: needs title and when`);
      const film = item.film;
      if (!isObject(film)) throw new Error(`${where}: needs film settings`);
      if (
        film.theme != null &&
        typeof film.theme === 'string' &&
        !Object.hasOwn(palettes(), film.theme)
      )
        throw new Error(
          `${where}: film.theme "${film.theme}" is not a palette`,
        );
      if (item.beats != null && typeof item.beats !== 'object')
        throw new Error(`${where}: beats must be an object`);
      if (!Array.isArray(item.rules ?? []))
        throw new Error(`${where}: rules must be a list of strings`);
      if (
        item.playbook != null &&
        !items('playbooks').some((p) => p.id === item.playbook)
      )
        throw new Error(
          `${where}: playbook "${String(item.playbook)}" is not a playbook`,
        );
      if (film.type != null && !items('types').some((t) => t.id === film.type))
        throw new Error(
          `${where}: film.type "${String(film.type)}" is not a type voice (clearframe types)`,
        );
    },
    sketches(item, where) {
      if (!item.summary || !item.use)
        throw new Error(`${where}: needs summary and use`);
      if (typeof item.build !== 'function' && !item.elements && !item.formats)
        throw new Error(
          `${where}: needs elements (or formats: {landscape, vertical, …}) or, for built-ins, build(w, h)`,
        );
    },
    types(item, where) {
      known(
        item,
        [
          'order',
          'title',
          'when',
          'display',
          'emphasis',
          'case',
          'tracking',
          'leading',
        ],
        where,
      );
      validateType(item, where);
    },
    playbooks(item, where) {
      known(
        item,
        [
          'order',
          'title',
          'audience',
          'inputs',
          'recording',
          'sources',
          'beats',
          'theme',
          'motion',
          'texture',
          'frame',
          'speakers',
          'voice',
          'format',
          'backdrop',
          'captions',
          'note',
          'lens',
          'camera',
          'heading',
          'textMotion',
          'type',
          'transition',
          'sfx',
          'music',
          'endings',
        ],
        where,
      );
      if (!item.title || !item.audience || !item.inputs)
        throw new Error(`${where}: needs title, audience and inputs`);
      // Alternative closing beats, one picked per project, so films from one playbook don't share an ending.
      if (
        item.endings != null &&
        (!isList(item.endings) ||
          item.endings.some(
            (e) =>
              !isObject(e) ||
              typeof e.name !== 'string' ||
              typeof e.about !== 'string' ||
              !isList(e.beats) ||
              !e.beats.length,
          ))
      )
        throw new Error(
          `${where}: endings must be [{name, about, beats: [...]}]`,
        );
      if (
        item.sources != null &&
        (!isList(item.sources) ||
          item.sources.some(
            (s) =>
              !isRecord(s) ||
              !(
                (text(s.claim) && text(s.source)) ||
                (text(s.id) && text(s.title))
              ),
          ))
      )
        throw new Error(
          `${where}: sources must contain claim/source or id/title entries`,
        );
      if (!isList(item.beats) || !item.beats.length)
        throw new Error(`${where}: needs beats`);
      item.beats.forEach((b, i) => {
        if (!isObject(b) || typeof b.block !== 'string')
          throw new Error(`${where}: beats[${i}] needs a block`);
      });
    },
  };
}
