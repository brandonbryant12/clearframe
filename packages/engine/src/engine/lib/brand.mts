// Portable brand/source files shared by idea, document and recording intake.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { palette } from '../../film/catalog.mjs';
import { contrast, typeById, vendor } from '../../film/library.mjs';
import { writeJSON } from './util.mjs';
import { rasterizeSVG } from './svg-assets.mjs';
import { isRecord } from './errors.mjs';
import type { Storyboard } from '../domain.mjs';
import type { PaletteKey } from '../../film/types.mjs';

export interface CopiedInput {
  sha256: string;
  bytes: number;
}
export type BrandAssetKind = 'image' | 'clip' | 'sfx';
export interface BrandAsset {
  id: string;
  kind: BrandAssetKind;
  file: string;
  role?: string;
  source: string;
}
export interface Brand {
  name: string;
  theme?: string | Record<string, string>;
  type?: string;
  voiceStyle?: string;
  rules?: string[];
  assets: BrandAsset[];
}
export type SvgConversion = ReturnType<typeof rasterizeSVG>;
export interface BrandInventoryEntry extends CopiedInput {
  id: string;
  kind: BrandAssetKind;
  file: string;
  role: string;
  original?: CopiedInput & { file: string };
  conversion?: SvgConversion;
}

// A kit can contain large recordings: copy on disk and hash with bounded memory.
export function copyInput(source: string, destination: string): CopiedInput {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
  const digest = crypto.createHash('sha256'),
    buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(destination, 'r');
  let bytes = 0;
  try {
    for (;;) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      digest.update(buffer.subarray(0, count));
      bytes += count;
    }
  } finally {
    fs.closeSync(fd);
  }
  return { sha256: digest.digest('hex'), bytes };
}
const nonempty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const extensions: Record<BrandAssetKind, string[]> = {
  image: ['.svg', '.png', '.jpg', '.jpeg', '.webp'],
  clip: ['.mp4', '.mov'],
  sfx: ['.wav', '.mp3', '.m4a'],
};
const isAssetKind = (kind: unknown): kind is BrandAssetKind =>
  typeof kind === 'string' && Object.hasOwn(extensions, kind);
const CONTRAST: readonly (readonly [PaletteKey, number])[] = [
  ['ink', 4.5],
  ['muted', 4.5],
  ['accent', 4.5],
  ['accent2', 3],
];

function brandTheme(
  theme: unknown,
): string | Record<string, string> | undefined {
  if (theme == null) return undefined;
  if (typeof theme !== 'string' && !isRecord(theme))
    throw new Error('theme must be a preset name or a palette object');
  // palette() refuses unknown presets and malformed colors; the theme is then a name or a color map.
  const colors = palette(theme);
  for (const [key, minimum] of CONTRAST) {
    if (contrast(colors[key], colors.bg) < minimum)
      throw new Error(
        `brand.theme.${key} needs ${minimum}:1 contrast against bg`,
      );
  }
  if (typeof theme === 'string') return theme;
  return Object.fromEntries(
    Object.entries(theme).map(([key, value]): [string, string] => [
      key,
      String(value),
    ]),
  );
}

function brandAsset(a: unknown, ids: Set<string>, file: string): BrandAsset {
  if (!isRecord(a)) throw new Error('Each brand asset must be an object');
  for (const key of Object.keys(a))
    if (!['id', 'kind', 'file', 'role'].includes(key))
      throw new Error(`Unknown brand asset field: ${key}`);
  if (
    !nonempty(a.id) ||
    !/^[a-z0-9][a-z0-9_-]*$/i.test(a.id) ||
    ids.has(a.id.toLowerCase())
  )
    throw new Error('Brand asset IDs must be unique slugs');
  const id = a.id;
  ids.add(id.toLowerCase());
  const kind = a.kind ?? 'image';
  if (
    !nonempty(a.file) ||
    !isAssetKind(kind) ||
    !extensions[kind].includes(path.extname(a.file).toLowerCase())
  )
    throw new Error(
      `Unsupported brand asset ${id}: use a local SVG/PNG/JPEG/WebP image, MP4/MOV clip, or WAV/MP3/M4A sound`,
    );
  if (a.role != null && !nonempty(a.role))
    throw new Error(`brand asset ${id}.role must be text`);
  const source = path.resolve(path.dirname(file), a.file);
  if (!fs.statSync(source).isFile())
    throw new Error(`Brand asset ${id} is not a regular file`);
  const role = nonempty(a.role) ? { role: a.role } : {};
  return {
    id,
    kind,
    file: `assets/brand/${id}${path.extname(a.file).toLowerCase()}`,
    ...role,
    source,
  };
}

export function readBrand(file: string | null | undefined): Brand | null {
  if (!file) return null;
  const spec: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isRecord(spec)) throw new Error('brand must be a JSON object');
  const allowed = ['name', 'theme', 'type', 'voiceStyle', 'rules', 'assets'];
  for (const key of Object.keys(spec))
    if (!allowed.includes(key)) throw new Error(`Unknown brand field: ${key}`);
  if (!nonempty(spec.name) || spec.name.length > 80)
    throw new Error('brand.name must be 1–80 characters');
  const theme = brandTheme(spec.theme);
  const rules = validateBrandOptions(spec);
  const ids = new Set<string>();
  const listed: unknown[] = Array.isArray(spec.assets) ? spec.assets : [];
  const assets = listed.map((a) => brandAsset(a, ids, file));
  return {
    name: spec.name,
    ...(theme === undefined ? {} : { theme }),
    ...(typeof spec.type === 'string' ? { type: spec.type } : {}),
    ...(nonempty(spec.voiceStyle) ? { voiceStyle: spec.voiceStyle } : {}),
    ...(Array.isArray(rules) ? { rules: rules.filter(nonempty) } : {}),
    assets,
  };
}

function validateBrandOptions(spec: Record<string, unknown>) {
  if (
    spec.type != null &&
    (typeof spec.type !== 'string' || !typeById(spec.type))
  )
    throw new Error(
      'brand.type must name an installed type voice (clearframe types)',
    );
  if (
    spec.voiceStyle != null &&
    (!nonempty(spec.voiceStyle) || spec.voiceStyle.length > 1000)
  )
    throw new Error('brand.voiceStyle must be 1–1000 characters');
  const rules = spec.rules;
  if (
    rules != null &&
    (!Array.isArray(rules) || rules.some((r) => !nonempty(r)))
  )
    throw new Error('brand.rules must be a list of nonempty strings');
  if (spec.assets != null && !Array.isArray(spec.assets))
    throw new Error('brand.assets must be a list');
  return rules;
}

function inventoryLine(a: BrandInventoryEntry): string {
  const original =
    a.original && a.conversion
      ? `\n  Original: ${a.original.file}; SHA-256 ${a.original.sha256}. PNG converted with ${a.conversion.tool}, ${a.conversion.width}×${a.conversion.height}.`
      : '';
  const live = a.conversion?.liveText
    ? '\n  Live SVG text uses local fonts: compare the PNG against the approved artwork; use outlined lettering for portable identity.'
    : '';
  return (
    `- ${a.id}: ${a.file} (${a.role}); SHA-256 ${a.sha256}` + original + live
  );
}

function writeBrandRecord(
  root: string,
  sb: Storyboard,
  brand: Brand,
  inventory: BrandInventoryEntry[],
): void {
  writeJSON(path.join(root, 'brand.json'), {
    ...brand,
    assets: brand.assets.map(({ source: _source, ...a }) => a),
  });
  fs.writeFileSync(
    path.join(root, 'BRAND.md'),
    `# ${brand.name}\n\n` +
      `Palette: ${JSON.stringify(sb.theme)}\nType voice: ${sb.type ?? 'inter'}\n\n## Rules\n${(brand.rules ?? []).map((r) => `- ${r}`).join('\n')}\n\n` +
      `## Assets\n${inventory.map(inventoryLine).join('\n')}\n\nUse the supplied identity unchanged. Assets are registered for placement by the director; they are not automatically overlaid on every scene.\n`,
  );
}

function copyBrandAsset(root: string, asset: BrandAsset): BrandInventoryEntry {
  const svg = path.extname(asset.file) === '.svg';
  const originalFile = svg ? `source/brand/${asset.id}.svg` : asset.file;
  const copied = copyInput(asset.source, path.join(root, originalFile));
  const base = {
    id: asset.id,
    kind: asset.kind,
    role: asset.role ?? 'reference',
  };
  if (!svg) return { ...base, file: asset.file, ...copied };
  const original = { file: originalFile, ...copied };
  asset.file = `assets/brand/${asset.id}.png`;
  const raster = path.join(root, asset.file);
  fs.mkdirSync(path.dirname(raster), { recursive: true });
  const conversion = rasterizeSVG(path.join(root, originalFile), raster);
  return {
    ...base,
    file: asset.file,
    sha256: crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(root, asset.file)))
      .digest('hex'),
    bytes: fs.statSync(path.join(root, asset.file)).size,
    original,
    conversion,
  };
}

export interface ApplyBrandOptions {
  recording?: boolean;
  theme?: string | Record<string, string>;
}

/** Apply copied assets and brand settings; recorded narration never receives a new voice. */
export function applyBrand(
  root: string,
  sb: Storyboard,
  brand: Brand | null | undefined,
  { recording = false, theme }: ApplyBrandOptions = {},
): BrandInventoryEntry[] {
  if (brand?.type) sb.type = brand.type;
  if (!recording && brand?.voiceStyle)
    sb.voice = { ...(sb.voice ?? {}), style: brand.voiceStyle };
  if (brand && sb.frame)
    sb.frame = { ...(isRecord(sb.frame) ? sb.frame : {}), brand: brand.name };
  const chosen = theme ?? brand?.theme;
  if (chosen) sb.theme = chosen;
  const inventory: BrandInventoryEntry[] = [];
  for (const asset of brand?.assets ?? []) {
    if ((sb.assets ?? []).some((a) => a.id === asset.id))
      throw new Error(`Brand asset ID ${asset.id} conflicts with the playbook`);
    inventory.push(copyBrandAsset(root, asset));
    (sb.assets ??= []).push({
      id: asset.id,
      kind: asset.kind,
      file: asset.file,
    });
  }
  if (brand) writeBrandRecord(root, sb, brand, inventory);
  const base = typeof sb.theme === 'string' ? sb.theme : sb.theme?.base;
  vendor(root, [['palettes', base] as const, ['types', sb.type] as const]);
  return inventory;
}
