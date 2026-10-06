// Portable brand/source files shared by idea, document and recording intake.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { palette } from '../../film/catalog.mjs';
import { contrast, typeById, vendor } from '../../film/library.mjs';
import { writeJSON } from './util.mjs';
import { rasterizeSVG } from './svg-assets.mjs';

// A kit can contain large recordings: copy on disk and hash with bounded memory.
export function copyInput(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
  const digest = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(destination, 'r');
  let bytes = 0;
  try {
    for (;;) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      digest.update(buffer.subarray(0, count));
      bytes += count;
    }
  } finally { fs.closeSync(fd); }
  return { sha256: digest.digest('hex'), bytes };
}
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const extensions = { image: ['.svg', '.png', '.jpg', '.jpeg', '.webp'], clip: ['.mp4', '.mov'], sfx: ['.wav', '.mp3', '.m4a'] };

export function readBrand(file) {
  if (!file) return null;
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!object(spec)) throw new Error('brand must be a JSON object');
  const allowed = ['name', 'theme', 'type', 'voiceStyle', 'rules', 'assets'];
  for (const key of Object.keys(spec)) if (!allowed.includes(key)) throw new Error(`Unknown brand field: ${key}`);
  if (!nonempty(spec.name) || spec.name.length > 80) throw new Error('brand.name must be 1–80 characters');
  if (spec.theme != null) {
    const colors = palette(spec.theme);
    for (const [key, minimum] of [['ink', 4.5], ['muted', 4.5], ['accent', 4.5], ['accent2', 3]]) {
      if (contrast(colors[key], colors.bg) < minimum) throw new Error(`brand.theme.${key} needs ${minimum}:1 contrast against bg`);
    }
  }
  if (spec.type != null && (typeof spec.type !== 'string' || !typeById(spec.type)))
    throw new Error('brand.type must name an installed type voice (clearframe types)');
  if (spec.voiceStyle != null && (!nonempty(spec.voiceStyle) || spec.voiceStyle.length > 1000))
    throw new Error('brand.voiceStyle must be 1–1000 characters');
  if (spec.rules != null && (!Array.isArray(spec.rules) || spec.rules.some(r => !nonempty(r))))
    throw new Error('brand.rules must be a list of nonempty strings');
  if (spec.assets != null && !Array.isArray(spec.assets)) throw new Error('brand.assets must be a list');
  const ids = new Set();
  const assets = (spec.assets ?? []).map(a => {
    if (!object(a)) throw new Error('Each brand asset must be an object');
    for (const key of Object.keys(a)) if (!['id', 'kind', 'file', 'role'].includes(key)) throw new Error(`Unknown brand asset field: ${key}`);
    if (!nonempty(a.id) || !/^[a-z0-9][a-z0-9_-]*$/i.test(a.id) || ids.has(a.id.toLowerCase())) throw new Error('Brand asset IDs must be unique slugs');
    ids.add(a.id.toLowerCase());
    const kind = a.kind ?? 'image';
    if (!nonempty(a.file) || typeof kind !== 'string' || !Object.hasOwn(extensions, kind) || !extensions[kind]?.includes(path.extname(a.file).toLowerCase()))
      throw new Error(`Unsupported brand asset ${a.id}: use a local SVG/PNG/JPEG/WebP image, MP4/MOV clip, or WAV/MP3/M4A sound`);
    if (a.role != null && !nonempty(a.role)) throw new Error(`brand asset ${a.id}.role must be text`);
    const source = path.resolve(path.dirname(file), a.file);
    if (!fs.statSync(source).isFile()) throw new Error(`Brand asset ${a.id} is not a regular file`);
    return { ...a, kind, source, file: `assets/brand/${a.id}${path.extname(a.file).toLowerCase()}` };
  });
  return { ...spec, assets };
}

/** Apply copied assets and brand settings; recorded narration never receives a new voice. */
export function applyBrand(root, sb, brand, { recording = false, theme } = {}) {
    if (brand?.type) sb.type = brand.type;
    if (!recording && brand?.voiceStyle) sb.voice = { ...(sb.voice ?? {}), style: brand.voiceStyle };
    if (brand && sb.frame) sb.frame = { ...(object(sb.frame) ? sb.frame : {}), brand: brand.name };
    if (theme ?? brand?.theme) sb.theme = theme ?? brand.theme;
    const inventory = [];
    for (const asset of brand?.assets ?? []) {
      if ((sb.assets ?? []).some(a => a.id === asset.id)) throw new Error(`Brand asset ID ${asset.id} conflicts with the playbook`);
      const svg = path.extname(asset.file) === '.svg';
      const originalFile = svg ? `source/brand/${asset.id}.svg` : asset.file;
      const copied = copyInput(asset.source, path.join(root, originalFile));
      let conversion, original;
      if (svg) {
        original = { file: originalFile, ...copied };
        asset.file = `assets/brand/${asset.id}.png`;
        const raster = path.join(root, asset.file);
        fs.mkdirSync(path.dirname(raster), { recursive: true });
        conversion = rasterizeSVG(path.join(root, originalFile), raster);
      }
      const entry = { id: asset.id, kind: asset.kind, file: asset.file, role: asset.role ?? 'reference',
        ...(svg ? { sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, asset.file))).digest('hex'),
          bytes: fs.statSync(path.join(root, asset.file)).size, original, conversion } : copied) };
      inventory.push(entry);
      (sb.assets ??= []).push({ id: asset.id, kind: asset.kind, file: asset.file });
    }
    if (brand) {
      writeJSON(path.join(root, 'brand.json'), { ...brand, assets: brand.assets.map(({ source, ...a }) => a) });
      fs.writeFileSync(path.join(root, 'BRAND.md'), `# ${brand.name}\n\n` +
        `Palette: ${JSON.stringify(sb.theme)}\nType voice: ${sb.type ?? 'inter'}\n\n## Rules\n${(brand.rules ?? []).map(r => `- ${r}`).join('\n')}\n\n` +
        `## Assets\n${inventory.map(a => `- ${a.id}: ${a.file} (${a.role}); SHA-256 ${a.sha256}` +
          (a.original ? `\n  Original: ${a.original.file}; SHA-256 ${a.original.sha256}. PNG converted with ${a.conversion.tool}, ${a.conversion.width}×${a.conversion.height}.` : '') +
          (a.conversion?.liveText ? '\n  Live SVG text uses local fonts: compare the PNG against the approved artwork; use outlined lettering for portable identity.' : '')).join('\n')}\n\nUse the supplied identity unchanged. Assets are registered for placement by the director; they are not automatically overlaid on every scene.\n`);
    }
    vendor(root, [['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base], ['types', sb.type]]);
    return inventory;
}
