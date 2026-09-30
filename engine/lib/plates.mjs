// Depth plates: one scene description becomes three generated layers that stand at different
// depths, so the camera can move through generated art with real parallax:
//   far  a full-bleed background (sky, horizon, distant forms)
//   mid  the subject, cut out on transparency
//   near foreground framing at the edges, cut out on transparency
// Cut-outs are generated on flat chroma green and keyed out with ffmpeg, so any image model
// works. Plates are illustration: text, numbers and evidence stay native.
import fs from 'node:fs';
import { ffmpeg } from './util.mjs';

// Cut-out layers describe objects, never scenes: asked for a scene "on green", image models
// paint a framed picture of the scene on green. So the mid layer draws the `subject` alone
// and the near layer only the `foreground` entering from the edges.
export const LAYERS = {
  far: {
    z: 6,
    cutout: false,
    prompt: a =>
      `${a.prompt}. A wide background painting of the whole setting, no figures close to the camera; other layers will stand in front of it.`,
  },
  mid: {
    z: 1.2,
    cutout: true,
    prompt: a =>
      `${a.subject ?? `The main subject of this setting: ${a.prompt}`}. Draw only this subject as one isolated object with clean natural edges: no outline, no white border, no scenery, no sky, no ground plane, no water, no frame or picture-in-picture. Whole and uncropped, centred, with empty green all around it.`,
  },
  near: {
    z: -0.35,
    cutout: true,
    prompt: a =>
      `${a.foreground ?? `Foreground framing that suits this setting: ${a.prompt}`}: large, very close to the camera, entering only from the left and right edges of the image. Nothing else: no sky, no landscape, no horizon, no light or colour on the background. The whole centre of the image is empty green: no picture, frame, window or scene in it.`,
  },
};

export const CHROMA =
  'Isolated on a perfectly flat, uniform pure green (#00FF00) background, like a studio green screen: no shadow, gradient, floor or reflection on the background, crisp clean edges, and nothing green in the subject itself.';

/** Assets with `layers: true` become three generated assets: `ID-far`, `ID-mid`, `ID-near`. */
export function expandAssets(assets = []) {
  return assets.flatMap(a => {
    if (a.kind !== 'image' || !a.layers) return [a];
    const { layers, id, prompt, subject, foreground, ...rest } = a;
    const pick = layers === true ? Object.keys(LAYERS) : layers;
    return pick.map(k => ({
      ...rest,
      id: `${id}-${k}`,
      kind: 'image',
      prompt: LAYERS[k].prompt({ prompt, subject, foreground }),
      ...(LAYERS[k].cutout ? { cutout: true } : {}),
      plate: { of: id, layer: k },
    }));
  });
}

/**
 * Key a chroma-green generation to a PNG with transparency (and pull green spill off edges).
 * Models rarely paint exactly #00FF00, so the key colour is sampled from the image corners.
 */
export async function keyOut(src, dst) {
  const key = (await cornerColour(src)) ?? '00FF00';
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
async function cornerColour(src) {
  const { spawnSync } = await import('node:child_process');
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
  const at = (x, y) => [0, 1, 2].map(c => px[(y * 16 + x) * 3 + c]);
  const samples = [at(0, 0), at(15, 0), at(0, 15), at(15, 15), at(1, 1), at(14, 1), at(1, 14), at(14, 14)];
  const median = c => samples.map(s => s[c]).sort((a, b) => a - b)[samples.length >> 1];
  const [red, green, blue] = [median(0), median(1), median(2)];
  if (!(green > 90 && green > red * 1.5 && green > blue * 1.5)) return null;
  return [red, green, blue]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Canvas elements that stage a plate set in depth for a `w`×`h` frame: the far layer is
 * oversized so camera moves never show its edge; the near layer is soft with nearness.
 */
export function plateElements(id, { w, h, layers = ['far', 'mid', 'near'] }) {
  const out = [];
  if (layers.includes('far'))
    out.push({
      type: 'image',
      asset: `${id}-far`,
      x: Math.round(-w * 0.08),
      y: Math.round(-h * 0.08),
      w: Math.round(w * 1.16),
      h: Math.round(h * 1.16),
      fit: 'cover',
      z: LAYERS.far.z,
      at: 0,
      dur: 0,
    });
  if (layers.includes('mid'))
    out.push({
      type: 'image',
      asset: `${id}-mid`,
      x: 0,
      y: 0,
      w,
      h,
      fit: 'contain',
      z: LAYERS.mid.z,
      at: 0,
      enter: 'fade',
      dur: 0.6,
    });
  if (layers.includes('near'))
    out.push({
      type: 'image',
      asset: `${id}-near`,
      x: Math.round(-w * 0.06),
      y: Math.round(-h * 0.06),
      w: Math.round(w * 1.12),
      h: Math.round(h * 1.12),
      fit: 'cover',
      z: LAYERS.near.z,
      blur: 3,
      at: 0,
      dur: 0,
    });
  return out;
}
