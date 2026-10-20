import fs from 'node:fs';
import path from 'node:path';

import type {
  DirectionItem,
  LibraryItemBase,
  LibraryKind,
  PaletteColors,
  PaletteItem,
  PlaybookItem,
  SketchItem,
  TreatmentItem,
  TypeItem,
} from './types.mjs';

import { LIBRARY, KINDS } from './library-constants.mjs';
import { createValidators } from './library-validation.mjs';
import {
  emptyMaps,
  entries,
  readJSONItem,
  moduleItem,
  stored,
  readLayer,
  type KindMaps,
  type Layer,
} from './library-load.mjs';
export {
  LIBRARY,
  KINDS,
  PALETTE_KEYS,
  isPaletteKey,
} from './library-constants.mjs';
export { contrast } from './library-validation.mjs';
const VALIDATE = createValidators({ items, palettes: () => palettes() });
const builtin: KindMaps = emptyMaps();
for (const kind of KINDS) {
  for (const { file, id, where } of entries(path.join(LIBRARY, kind))) {
    const item = file.endsWith('.json')
      ? readJSONItem(where, id, kind)
      : await moduleItem(where);
    builtin[kind].set(id, stored(id, item, where));
  }
}

// Layers over the built-ins, lowest first: shared libraries named in CLEARFRAME_LIBRARY
// (path-separated; a brand kit or a workspace's templates), then the open project's library/.
let layers: Layer[] = [];
const shared = (): string[] =>
  (process.env.CLEARFRAME_LIBRARY ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .map((d) => path.resolve(d));

/** Reload mutable JSON libraries at the project boundary; built-ins remain cached. */
export function useProject(root: string | null | undefined): void {
  const dirs = [
    ...shared(),
    ...(root ? [path.join(path.resolve(root), 'library')] : []),
  ];
  const previousLayers = layers;
  layers = [];
  try {
    for (const dir of dirs) {
      const layer = readLayer(dir);
      layers.push(layer);
      // Validate as each layer lands, so a treatment can name a palette from its own or a lower layer.
      for (const kind of KINDS)
        for (const it of layer.items[kind].values())
          VALIDATE[kind](it, it.source);
    }
  } catch (error) {
    layers = previousLayers;
    throw error;
  }
}
/** The library folders in effect, lowest first (built-ins, then shared, then project). */
export const libraryDirs = (): string[] => [
  LIBRARY,
  ...layers.map((l) => l.dir),
];

// Each kind's items have passed VALIDATE[kind] as their layer loaded, so they are returned as
// that kind's item type.
/** Every item of a kind, built-in then project, in `order` (then id), project items winning. */
export function items(kind: 'palettes'): PaletteItem[];
export function items(kind: 'treatments'): TreatmentItem[];
export function items(kind: 'sketches'): SketchItem[];
export function items(kind: 'playbooks'): PlaybookItem[];
export function items(kind: 'types'): TypeItem[];
export function items(kind: 'directions'): DirectionItem[];
export function items(kind: LibraryKind): LibraryItemBase[];
export function items(kind: LibraryKind): LibraryItemBase[] {
  const merged = new Map(builtin[kind]);
  for (const layer of layers)
    for (const [id, it] of layer.items[kind]) merged.set(id, it);
  return [...merged.values()].sort(
    (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id.localeCompare(b.id),
  );
}
export function item(kind: 'palettes', id: unknown): PaletteItem | undefined;
export function item(
  kind: 'treatments',
  id: unknown,
): TreatmentItem | undefined;
export function item(kind: 'sketches', id: unknown): SketchItem | undefined;
export function item(kind: 'playbooks', id: unknown): PlaybookItem | undefined;
export function item(kind: 'types', id: unknown): TypeItem | undefined;
export function item(
  kind: 'directions',
  id: unknown,
): DirectionItem | undefined;
export function item(
  kind: LibraryKind,
  id: unknown,
): LibraryItemBase | undefined;
export function item(
  kind: LibraryKind,
  id: unknown,
): LibraryItemBase | undefined {
  return items(kind).find((x) => x.id === id);
}

/**
 * Copy the named items into DIR/library/ when they come from a shared library, so a project
 * scaffolded from a brand kit still renders without it. Built-ins are left as references.
 */
export function vendor(
  dir: string,
  refs: Iterable<readonly [LibraryKind, string | null | undefined]>,
): void {
  for (const [kind, id] of refs) {
    const it = id && item(kind, id);
    if (!it || it.source.startsWith(LIBRARY + path.sep)) continue;
    const to = path.join(dir, 'library', kind, path.basename(it.source));
    if (path.resolve(to) === path.resolve(it.source)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(it.source, to);
  }
}

/** Type voices (built-ins plus any in the project's library/), and one by id. */
export const types = (): TypeItem[] => items('types');
export const typeById = (id: unknown): TypeItem | undefined =>
  item('types', id);

/** Palettes as {id: colors}. */
export const palettes = (): Record<string, PaletteColors> =>
  Object.fromEntries(items('palettes').map((p) => [p.id, p.colors]));
export const paletteNotes = (): Record<string, string> =>
  Object.fromEntries(items('palettes').map((p) => [p.id, p.notes ?? '']));

// Validate the built-ins once (palettes first: treatments reference them), then pick up
// any shared libraries so listings and scaffolds see them without a project.
for (const kind of KINDS)
  for (const it of builtin[kind].values()) VALIDATE[kind](it, it.source);
useProject(null);
