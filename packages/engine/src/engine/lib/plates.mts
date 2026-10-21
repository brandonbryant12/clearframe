// Depth plates: one scene description becomes three generated layers that stand at different
// depths, so the camera can move through generated art with real parallax:
//   far  a full-bleed background (sky, horizon, distant forms)
//   mid  the subject, cut out on transparency
//   near foreground framing at the edges, cut out on transparency
// Cut-outs are generated on flat chroma green and keyed out with ffmpeg, so any image model
// works. Plates are illustration: text, numbers and evidence stay native.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ffmpeg } from './util.mjs';
import type { AlphaBounds } from './plates-layers.mjs';

export {
  CHROMA,
  LAYERS,
  PLATE_LAYERS,
  expandAssets,
} from './plates-layers.mjs';
export type {
  AlphaBounds,
  LayerBrief,
  LayeredAsset,
  LayerSpec,
  PlateLayer,
  PlateLayerAsset,
} from './plates-layers.mjs';
export { plateElements } from './plates-elements.mjs';
export type {
  PlateElement,
  PlateFrame,
  PlateStaging,
  StagedPlateAsset,
} from './plates-elements.mjs';

const bounds = new Map<string, AlphaBounds | null>();
const SAMPLE_W = 192;

/** The bounding box of alpha above half, in a `W`×`H` grey alpha raster, as fractions; null when empty. */
function alphaBox(
  a: Uint8Array,
  W: number,
  H: number,
): AlphaBounds['box'] | null {
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (a[y * W + x] <= 128) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  return x1 >= 0 ? [x0 / W, y0 / H, (x1 + 1) / W, (y1 + 1) / H] : null;
}

/**
 * Where a cut-out's subject sits: its alpha bounding box as fractions of the image, plus the
 * image size. Used to ground the subject (a contact shadow, a reflection on water).
 */
export function alphaBounds(png: string): AlphaBounds | null {
  const known = bounds.get(png);
  if (known !== undefined) return known;
  let found: AlphaBounds | null = null;
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      png,
    ],
    {
      encoding: 'utf8',
    },
  );
  const [iw, ih] = (probe.stdout ?? '').trim().split(',').map(Number);
  const W = SAMPLE_W,
    H = Math.max(1, Math.round((SAMPLE_W * ih) / iw) || 108);
  const r = spawnSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    png,
    '-vf',
    `scale=${W}:${H},format=rgba,alphaextract`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'gray',
    '-',
  ]);
  const a = r.stdout;
  if (iw > 0 && a && a.length >= W * H) {
    const box = alphaBox(a, W, H);
    if (box) found = { box, size: [iw, ih] };
  }
  bounds.set(png, found);
  return found;
}

/**
 * Key a chroma-green generation to a PNG with transparency (and pull green spill off edges).
 * Models rarely paint exactly #00FF00, so the key colour is sampled from the image corners.
 */
export async function keyOut(src: string, dst: string): Promise<string> {
  const key = cornerColour(src) ?? '00FF00';
  await ffmpeg([
    '-y',
    '-i',
    src,
    '-vf',
    `chromakey=0x${key}:0.2:0.06,despill=type=green:mix=0.6,format=rgba`,
    '-frames:v',
    '1',
    '-update',
    '1',
    dst,
  ]);
  if (!fs.existsSync(dst)) throw new Error(`keying failed for ${src}`);
  return dst;
}

/** The median colour of the four corner patches, as RRGGBB, if it is clearly green. */
function cornerColour(src: string): string | null {
  const r = spawnSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    src,
    '-vf',
    'scale=16:16:flags=area',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-',
  ]);
  const px = r.stdout;
  if (!px || px.length < 16 * 16 * 3) return null;
  const at = (x: number, y: number): number[] =>
    [0, 1, 2].map((c) => px[(y * 16 + x) * 3 + c]);
  const samples = [
    at(0, 0),
    at(15, 0),
    at(0, 15),
    at(15, 15),
    at(1, 1),
    at(14, 1),
    at(1, 14),
    at(14, 14),
  ];
  const median = (c: number): number =>
    samples.map((s) => s[c]).sort((a, b) => a - b)[samples.length >> 1];
  const [red, green, blue] = [median(0), median(1), median(2)];
  if (!(green > 90 && green > red * 1.5 && green > blue * 1.5)) return null;
  return [red, green, blue]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
