import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  JsonRecord,
  LibraryItemBase,
  LibraryKind,
  PaletteKey,
} from './types.mjs';

export const LIBRARY = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'library',
);
export const KINDS: LibraryKind[] = [
  'palettes',
  'treatments',
  'sketches',
  'playbooks',
  'types',
  'directions',
];
export const PALETTE_KEYS: PaletteKey[] = [
  'bg',
  'surface',
  'ink',
  'muted',
  'accent',
  'accent2',
  'positive',
  'negative',
];
export const isPaletteKey = (key: string): key is PaletteKey =>
  PALETTE_KEYS.some((value) => value === key);

/** An item as read from its file, with its id and source; VALIDATE checks the rest by kind. */
export type StoredItem = LibraryItemBase & JsonRecord;
