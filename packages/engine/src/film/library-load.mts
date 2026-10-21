import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { frames } from './sketch-kit.mjs';

import { isRecord, messageOf } from './guards.mjs';
import type { JsonRecord, LibraryKind, SketchDrawing } from './types.mjs';

import { KINDS, type StoredItem } from './library-constants.mjs';
import { decodeSketchDrawing } from './library-sketch-schema.mjs';
// ------------------------------------------------------------------ loading

/** A JSON sketch becomes a build(w, h): the variant for the frame's shape, else the default. */
export function jsonSketch(item: JsonRecord & { name: string }): JsonRecord {
  return {
    ...item,
    build(w: number, h: number): SketchDrawing {
      const frameName = Object.entries(frames).find(
        ([, [fw, fh]]) => fw === w && fh === h,
      )?.[0];
      const formats = isRecord(item.formats) ? item.formats : null;
      const variant =
        (frameName && formats?.[frameName]) ??
        formats?.[h > w ? 'vertical' : 'landscape'];
      const {
        formats: _formats,
        summary: _summary,
        use: _use,
        name: _name,
        order: _order,
        ...rest
      } = item;
      // The drawing is checked where it is drawn (canvas normalizeElements), like any authored canvas.
      return decodeSketchDrawing(structuredClone(variant ?? rest));
    },
  };
}

export function readJSONItem(
  where: string,
  id: string,
  kind: LibraryKind,
): JsonRecord {
  let item: unknown;
  try {
    item = JSON.parse(fs.readFileSync(where, 'utf8'));
  } catch (e) {
    throw new Error(`${where}: ${messageOf(e)}`);
  }
  if (!isRecord(item))
    throw new Error(`${where}: a library item is a JSON object`);
  if (kind !== 'sketches') return item;
  const { name, ...rest } = item;
  return jsonSketch({ name: typeof name === 'string' ? name : id, ...rest });
}
export const entries = (
  dir: string,
): { file: string; id: string; where: string }[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .sort()
        .filter(
          (f) =>
            !f.startsWith('_') &&
            !f.endsWith('.d.mts') &&
            /\.(json|mjs|mts)$/.test(f),
        )
        .map((f) => ({
          file: f,
          id: f.replace(/\.(json|mjs|mts)$/, ''),
          where: path.join(dir, f),
        }))
    : [];

/** An item under its file's id (an id the file states itself wins) and the file it came from. */
export const stored = (
  id: string,
  item: JsonRecord,
  where: string,
): StoredItem => {
  const { id: stated, ...rest } = item;
  return {
    id: typeof stated === 'string' ? stated : id,
    ...rest,
    source: where,
  };
};

export type KindMaps = Record<LibraryKind, Map<string, StoredItem>>;
export interface Layer {
  dir: string;
  items: KindMaps;
}
export const emptyMaps = (): KindMaps => ({
  palettes: new Map(),
  treatments: new Map(),
  sketches: new Map(),
  playbooks: new Map(),
  types: new Map(),
  directions: new Map(),
});

/** A library folder outside the repository: JSON only, read synchronously. */
export function readLayer(dir: string): Layer {
  const layer: Layer = { dir, items: emptyMaps() };
  for (const kind of KINDS) {
    for (const { file, id, where } of entries(path.join(dir, kind))) {
      if (!file.endsWith('.json'))
        throw new Error(
          `${where}: library items outside the built-ins must be JSON`,
        );
      layer.items[kind].set(
        id,
        stored(id, readJSONItem(where, id, kind), where),
      );
    }
  }
  return layer;
}

/** A built-in sketch module's default export. */
export async function moduleItem(where: string): Promise<JsonRecord> {
  const mod: unknown = await import(pathToFileURL(where).href);
  const item = isRecord(mod) ? mod.default : null;
  if (!isRecord(item))
    throw new Error(`${where}: a library module exports its item as default`);
  return item;
}
