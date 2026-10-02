// The creative library: palettes, treatments, sketches and playbooks, one file per item.
//
// Built-in items live in library/<kind>/ at the repository root. Shared libraries (folders
// named in CLEARFRAME_LIBRARY, e.g. a brand kit or a team's templates) and a project's own
// library/ add or override items by id, in that order; useProject(root) sets the layers.
// Built-in sketches may be JavaScript modules (they lay out per frame size); every other
// item is JSON, so templates from outside stay data and never run code.
//
// Adding an idea is adding a file: no registry to edit. See library/README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frames } from './sketch-kit.mjs';
import { validateType } from './type.mjs';

export const LIBRARY = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'library');
export const KINDS = ['palettes', 'treatments', 'sketches', 'playbooks', 'types'];
export const PALETTE_KEYS = ['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'positive', 'negative'];

// ------------------------------------------------------------------ validation

const hex = v => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
function luminance(color) {
  const c = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const known = (item, keys, where) => {
  for (const k of Object.keys(item))
    if (!keys.includes(k) && k !== 'id' && k !== 'source') throw new Error(`${where}: unknown field "${k}"`);
};

const VALIDATE = {
  palettes(item, where) {
    known(item, ['order', 'title', 'notes', 'colors'], where);
    if (!item.colors || typeof item.colors !== 'object')
      throw new Error(`${where}: needs colors {${PALETTE_KEYS.join(', ')}}`);
    for (const k of PALETTE_KEYS) if (!hex(item.colors[k])) throw new Error(`${where}: colors.${k} must be #rrggbb`);
    for (const k of Object.keys(item.colors))
      if (!PALETTE_KEYS.includes(k)) throw new Error(`${where}: unknown colour "${k}"`);
    // Readability is part of the contract: text roles against the background.
    for (const [k, min] of [
      ['ink', 4.5],
      ['muted', 4.5],
      ['accent', 4.5],
      ['accent2', 3],
    ]) {
      const ratio = contrast(item.colors[k], item.colors.bg);
      if (ratio < min) throw new Error(`${where}: ${k} has ${ratio.toFixed(2)}:1 contrast on bg; needs ${min}:1`);
    }
  },
  treatments(item, where) {
    known(item, ['order', 'title', 'when', 'film', 'beats', 'rules', 'playbook'], where);
    if (!item.title || !item.when) throw new Error(`${where}: needs title and when`);
    if (!item.film || typeof item.film !== 'object') throw new Error(`${where}: needs film settings`);
    if (item.film.theme != null && typeof item.film.theme === 'string' && !palettes()[item.film.theme])
      throw new Error(`${where}: film.theme "${item.film.theme}" is not a palette`);
    if (item.beats != null && typeof item.beats !== 'object') throw new Error(`${where}: beats must be an object`);
    if (!Array.isArray(item.rules ?? [])) throw new Error(`${where}: rules must be a list of strings`);
    if (item.playbook != null && !items('playbooks').some(p => p.id === item.playbook))
      throw new Error(`${where}: playbook "${item.playbook}" is not a playbook`);
    if (item.film.type != null && !items('types').some(t => t.id === item.film.type))
      throw new Error(`${where}: film.type "${item.film.type}" is not a type voice (clearframe types)`);
  },
  sketches(item, where) {
    if (!item.summary || !item.use) throw new Error(`${where}: needs summary and use`);
    if (typeof item.build !== 'function' && !item.elements && !item.formats)
      throw new Error(`${where}: needs elements (or formats: {landscape, vertical, …}) or, for built-ins, build(w, h)`);
  },
  types(item, where) {
    known(item, ['order', 'title', 'when', 'display', 'emphasis', 'case', 'tracking', 'leading'], where);
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
        'heading',
        'textMotion',
        'type',
        'transition',
        'sfx',
        'music',
      ],
      where,
    );
    if (!item.title || !item.audience || !item.inputs) throw new Error(`${where}: needs title, audience and inputs`);
    if (!Array.isArray(item.beats) || !item.beats.length) throw new Error(`${where}: needs beats`);
    item.beats.forEach((b, i) => {
      if (!b || typeof b.block !== 'string') throw new Error(`${where}: beats[${i}] needs a block`);
    });
  },
};

// ------------------------------------------------------------------ loading

/** A JSON sketch becomes a build(w, h): the variant for the frame's shape, else the default. */
function jsonSketch(item) {
  return {
    ...item,
    build(w, h) {
      const shape = Object.entries(frames).find(([, [fw, fh]]) => fw === w && fh === h)?.[0];
      const variant = (shape && item.formats?.[shape]) ?? item.formats?.[h > w ? 'vertical' : 'landscape'];
      const { formats, summary, use, name, order, ...rest } = item;
      return structuredClone(variant ?? rest);
    },
  };
}

function readJSONItem(where, id, kind) {
  let item;
  try {
    item = JSON.parse(fs.readFileSync(where, 'utf8'));
  } catch (e) {
    throw new Error(`${where}: ${e.message}`);
  }
  return kind === 'sketches' ? jsonSketch({ name: id, ...item }) : item;
}
const entries = dir =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .sort()
        .filter(f => !f.startsWith('_') && /\.(json|mjs)$/.test(f))
        .map(f => ({ file: f, id: f.replace(/\.(json|mjs)$/, ''), where: path.join(dir, f) }))
    : [];

/** A library folder outside the repository: JSON only, read synchronously. */
function readLayer(dir) {
  const layer = { dir };
  for (const kind of KINDS) {
    layer[kind] = new Map();
    for (const { file, id, where } of entries(path.join(dir, kind))) {
      if (!file.endsWith('.json')) throw new Error(`${where}: library items outside the built-ins must be JSON`);
      layer[kind].set(id, { id, ...readJSONItem(where, id, kind), source: where });
    }
  }
  return layer;
}

const builtin = {};
for (const kind of KINDS) {
  builtin[kind] = new Map();
  for (const { file, id, where } of entries(path.join(LIBRARY, kind))) {
    const item = file.endsWith('.json')
      ? readJSONItem(where, id, kind)
      : (await import(pathToFileURL(where).href)).default;
    builtin[kind].set(id, { id, ...item, source: where });
  }
}

// Layers over the built-ins, lowest first: shared libraries named in CLEARFRAME_LIBRARY
// (path-separated; a brand kit or a workspace's templates), then the open project's library/.
let layers = [];
const shared = () =>
  (process.env.CLEARFRAME_LIBRARY ?? '')
    .split(path.delimiter)
    .filter(Boolean)
    .map(d => path.resolve(d));

/** Layer shared libraries and a project's library/ over the built-ins (null: shared only). Validates each item. */
export function useProject(root) {
  const dirs = [...shared(), ...(root ? [path.join(path.resolve(root), 'library')] : [])];
  const key = dirs.join('\n');
  if (layers.key === key) return;
  layers = [];
  for (const dir of dirs) {
    const layer = readLayer(dir);
    layers.push(layer);
    // Validate as each layer lands, so a treatment can name a palette from its own or a lower layer.
    for (const kind of KINDS) for (const it of layer[kind].values()) VALIDATE[kind](it, it.source);
  }
  layers.key = key;
}
/** The library folders in effect, lowest first (built-ins, then shared, then project). */
export const libraryDirs = () => [LIBRARY, ...layers.map(l => l.dir)];

/** Every item of a kind, built-in then project, in `order` (then id), project items winning. */
export function items(kind) {
  const merged = new Map(builtin[kind]);
  for (const layer of layers) for (const [id, item] of layer[kind]) merged.set(id, item);
  return [...merged.values()].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id.localeCompare(b.id));
}
export const item = (kind, id) => items(kind).find(x => x.id === id);

/**
 * Copy the named items into DIR/library/ when they come from a shared library, so a project
 * scaffolded from a brand kit still renders without it. Built-ins are left as references.
 */
export function vendor(dir, refs) {
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
export const types = () => items('types');
export const typeById = id => item('types', id);

/** Palettes as {id: colors}. */
export const palettes = () => Object.fromEntries(items('palettes').map(p => [p.id, p.colors]));
export const paletteNotes = () => Object.fromEntries(items('palettes').map(p => [p.id, p.notes ?? '']));

// Validate the built-ins once (palettes first: treatments reference them), then pick up
// any shared libraries so listings and scaffolds see them without a project.
for (const kind of KINDS) for (const it of builtin[kind].values()) VALIDATE[kind](it, it.source);
useProject(null);
