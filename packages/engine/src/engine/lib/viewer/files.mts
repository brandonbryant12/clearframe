// Every project file gets a preview type; fonts are embedded once for live specimens.
import fs from 'node:fs';
import path from 'node:path';
import type { ViewerFile } from './contracts.mjs';
import { hash, rel, fileHash, duration, frameAt, waveform } from './media.mjs';

export const TYPES: [string, RegExp][] = [
  ['image', /\.(png|jpe?g|webp|gif|avif|bmp)$/i],
  ['svg', /\.svg$/i],
  ['video', /\.(mp4|mov|webm|m4v)$/i],
  ['audio', /\.(wav|mp3|m4a|aac|ogg|flac|aiff?)$/i],
  ['font', /\.(ttf|otf|woff2?)$/i],
  ['text', /\.(json|jsonl|md|txt|csv|ya?ml|srt|vtt)$/i],
  ['document', /\.pdf$/i],
  ['model', /\.(blend|glb|gltf|obj|fbx|usdz?|vdb|abc)$/i],
];
export const fileType = (f: string) =>
  TYPES.find(([, re]) => re.test(f))?.[0] ?? 'other';
export const GROUPS = {
  image: 'Images',
  svg: 'Vector art',
  video: 'Video',
  audio: 'Audio',
  font: 'Fonts',
  text: 'Text and data',
  document: 'Documents',
  model: '3D and simulation',
  other: 'Other files',
};
export const FONT_MIME = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Fonts used anywhere in the page, embedded once in fonts.css so specimens work from a plain file. */
export interface FontEntry {
  id: string;
  family: string;
  style: string;
  file: string;
  license: string | null;
  origin: string | null;
  size: number;
  films: Set<string>;
  uses: Set<string>;
}
export class FontRegistry {
  readonly fonts: Map<string, FontEntry>;
  constructor() {
    this.fonts = new Map();
  }
  add(
    file: string,
    {
      family,
      style,
      license,
      origin,
    }: {
      family?: string;
      style?: string;
      license?: string;
      origin?: string;
    } = {},
  ) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) return null;
    const id = `f${hash(abs)}`;
    if (!this.fonts.has(id)) {
      const parts = path
          .basename(abs)
          .replace(/\.[^.]+$/, '')
          .split('-'),
        words = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2');
      this.fonts.set(id, {
        id,
        family: family ?? words(parts[0]),
        style: style ?? words(parts[1] ?? 'Regular'),
        file: abs,
        license: license ?? null,
        origin: origin ?? null,
        size: fs.statSync(abs).size,
        films: new Set(),
        uses: new Set(),
      });
    }
    return this.fonts.get(id);
  }
  css() {
    return [...this.fonts.values()]
      .map(
        (f) =>
          `@font-face{font-family:"${f.id}";src:url(data:${Object.entries(FONT_MIME).find(([extension]) => extension === path.extname(f.file).toLowerCase())?.[1] ?? 'font/ttf'};base64,${fs.readFileSync(f.file).toString('base64')});font-display:block}`,
      )
      .join('\n');
  }
  list(out: string) {
    return [...this.fonts.values()].map((f) => ({
      id: f.id,
      family: f.family,
      style: f.style,
      license: f.license,
      origin: f.origin,
      size: f.size,
      path: rel(out, f.file),
      name: path.basename(f.file),
      films: [...f.films],
      uses: [...f.uses],
    }));
  }
}

function audioGroup(name: string) {
  if (/(^|\/)vo\//.test(name)) return 'Narration';
  if (/(^|\/)music\//.test(name)) return 'Music';
  if (/(^|\/)sfx\//.test(name)) return 'Sound effects';
  return /^source\//.test(name) ? 'Recordings' : 'Audio';
}

export function describeFile(
  file: string,
  base: string,
  out: string,
  media: string,
  fonts: FontRegistry,
): ViewerFile {
  const type = fileType(file),
    size = fs.statSync(file).size,
    name = path.relative(base, file).split(path.sep).join('/');
  const info: ViewerFile = {
    name,
    type,
    group:
      Object.entries(GROUPS).find(([kind]) => kind === type)?.[1] ??
      'Other files',
    path: rel(out, file),
    size,
  };
  if (type === 'audio') {
    info.seconds = duration(file);
    info.wave = ((w) => w && rel(out, w))(waveform(file, media));
  }
  if (type === 'video') {
    info.seconds = duration(file);
    info.poster = ((p) => p && rel(out, p))(
      frameAt(
        file,
        media,
        `clip-${fileHash(file)}`,
        Math.min(1, (info.seconds ?? 2) / 2),
        480,
      ),
    );
  }
  if (type === 'text')
    info.preview = fs.readFileSync(file, 'utf8').slice(0, 4000);
  if (type === 'font')
    info.font = fonts.add(file, { origin: 'project' })?.id ?? null;
  // Audio placed by role, the way a reviewer thinks about it.
  if (type === 'audio') info.group = audioGroup(name);
  return info;
}

export const GROUP_ORDER = [
  'Video',
  'Images',
  'Vector art',
  'Narration',
  'Music',
  'Sound effects',
  'Recordings',
  'Audio',
  'Fonts',
  '3D and simulation',
  'Documents',
  'Text and data',
  'Other files',
];
export const byGroup = (a: ViewerFile, b: ViewerFile) =>
  GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
  a.name.localeCompare(b.name);

export function walkFiles(
  dir: string,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || skip.has(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else files.push(f);
    }
  };
  walk(dir);
  return files;
}
