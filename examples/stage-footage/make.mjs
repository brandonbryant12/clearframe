#!/usr/bin/env node
// A footage-led promo drawn on native stages: the bundled sculpture clips decoded as GPU
// textures (no raw cache), framed natively for portrait or landscape, with native type, a
// scrim, particles, a camera push with depth of field and dissolves between shots.
//
//   node examples/stage-footage/make.mjs --format vertical|landscape --out DIR
//
// The clips are original 3D studies (examples/sculptures, MIT); they illustrate a release and
// make no product claim. Copy, labels and the closing card stay native.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { format: { type: 'string', default: 'vertical' }, out: { type: 'string' } } });
if (!values.out) throw new Error('--out DIR is required');
const out = path.resolve(values.out);
if (fs.existsSync(path.join(out, 'storyboard.json'))) throw new Error(`${out} already has a project`);
const tall = values.format === 'vertical';
const here = path.dirname(new URL(import.meta.url).pathname);
const clips = ['petal-reveal', 'gap-bridge', 'ribbon-thread', 'exploded-core'];
fs.mkdirSync(path.join(out, 'assets/clips'), { recursive: true });
for (const c of clips) fs.copyFileSync(path.join(here, '../sculptures', c, 'clip.mp4'), path.join(out, 'assets/clips', `${c}.mp4`));

const [W, H] = tall ? [1080, 1920] : [1920, 1080];
const video = (id, clip, box, extra = {}) => ({ type: 'video', id, file: `assets/clips/${clip}.mp4`, x: box[0], y: box[1], w: box[2], h: box[3], enter: 'none', ...extra });
const scrim = { type: 'rect', id: 'scrim', x: 0, y: tall ? H * 0.55 : H * 0.5, w: W, h: tall ? H * 0.45 : H * 0.5, fill: { gradient: ['bg', 'bg'], angle: 90, fade: false }, opacity: 0.0, enter: 'none' };
const shade = { type: 'rect', id: 'shade', x: 0, y: tall ? H * 0.58 : H * 0.55, w: W, h: tall ? H * 0.42 : H * 0.45, fill: { gradient: ['#000000', '#000000'], angle: 90 }, opacity: 0.55, enter: 'none' };
const title = (text, say, y, size) => ({ type: 'text', text, x: tall ? 120 : 120, y, size, font: 'display', fill: '#ffffff', width: W - 240, say, enter: 'rise' });

const sb = {
  title: 'Sculpture studies, natively framed',
  format: { preset: tall ? 'vertical' : 'landscape', fps: 30 },
  theme: 'noir',
  transition: 'dissolve',
  captions: false,
  music: false,
  camera: 'none',
  lens: { grade: 'teal-orange', gradeAmount: 0.4, bloom: 0.25 },
  texture: { grain: 0.25, vignette: 0.5 },
  sources: [{ id: 'studies', title: 'ClearFrame sculpture studies (examples/sculptures), original Blender renders' }],
  beats: [
    {
      id: 'reveal', block: 'stage', duration: 3.6, transition: 'cut',
      vo: 'Four studies, one release.',
      props: {
        shutter: 0.5,
        elements: [video('petal', 'petal-reveal', [0, 0, W, H], { focusX: 0.5 }), shade],
        over: [
          title('Four studies, one release', 0.4, tall ? H * 0.78 : H * 0.8, tall ? 84 : 92),
          { type: 'particles', id: 'dust', kind: 'field', x: 0, y: 0, w: W, h: H, count: 900, size: 2.2, fill: '#ffe2b8', opacity: 0.6, flow: 30, enter: 'fade', at: 0 },
        ],
      },
    },
    {
      id: 'pair', block: 'stage', duration: 3.4,
      vo: 'A bridge, and a thread.',
      props: {
        elements: tall
          ? [video('bridge', 'gap-bridge', [0, 0, W, H / 2 - 6], { focusX: 0.55 }), video('thread', 'ribbon-thread', [0, H / 2 + 6, W, H / 2 - 6], { focusX: 0.45, at: 0.4, enter: 'fade' })]
          : [video('bridge', 'gap-bridge', [0, 0, W / 2 - 6, H], { focusX: 0.5 }), video('thread', 'ribbon-thread', [W / 2 + 6, 0, W / 2 - 6, H], { focusX: 0.5, at: 0.4, enter: 'fade' })],
        over: tall
          ? [
              { type: 'text', text: 'Bridge', x: 120, y: H / 2 - 70, size: 64, font: 'display', fill: '#ffffff', say: 'bridge', enter: 'rise', shadow: { blur: 18, opacity: 0.6 } },
              { type: 'text', text: 'Thread', x: 120, y: H - 200, size: 64, font: 'display', fill: '#ffffff', say: 'thread', enter: 'rise', shadow: { blur: 18, opacity: 0.6 } },
            ]
          : [
              { type: 'text', text: 'Bridge', x: 120, y: H - 120, size: 72, font: 'display', fill: '#ffffff', say: 'bridge', enter: 'rise', shadow: { blur: 18, opacity: 0.6 } },
              { type: 'text', text: 'Thread', x: W / 2 + 120, y: H - 120, size: 72, font: 'display', fill: '#ffffff', say: 'thread', enter: 'rise', shadow: { blur: 18, opacity: 0.6 } },
            ],
      },
    },
    {
      id: 'core', block: 'stage', duration: 3.8,
      vo: 'Then the core opens.',
      props: {
        shutter: 0.5,
        camera: { keys: [{ say: 'core', zoom: 1.12, dur: 2.6, ease: 'inOut' }], focus: { z: 0, aperture: 0 } },
        elements: [video('core', 'exploded-core', [0, 0, W, H], { focusX: 0.5 }), shade],
        over: [title('The core opens', 'opens', tall ? H * 0.8 : H * 0.82, tall ? 88 : 96)],
      },
    },
    {
      id: 'end', block: 'stage', duration: 3,
      vo: 'Made with native stages.',
      props: {
        ground: { material: 'noise', colors: ['bg', 'accent', 'accent2'], opacity: 0.55, z: 0 },
        over: [
          { type: 'text', text: 'Native stages', x: W / 2, y: H / 2, anchor: 'middle', size: tall ? 104 : 120, font: 'display', fill: 'ink', enter: 'rise', at: 0.2, shine: { every: 2.4 } },
          { type: 'text', text: 'GPU footage · type · materials', x: W / 2, y: H / 2 + (tall ? 90 : 100), anchor: 'middle', size: 34, font: 'mono', fill: 'muted', enter: 'fade', at: 0.5 },
        ],
      },
    },
  ],
};
fs.writeFileSync(path.join(out, 'storyboard.json'), JSON.stringify(sb, null, 2) + '\n');
console.log(out);
