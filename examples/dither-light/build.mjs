// A 1-bit product shot: a native stage whose ground, plinth, sphere and product are painted with
// the `dither` material (ordered Bayer dither in two palette inks under a drifting light). The
// product name and line are native type. One beat, both frame shapes.
// usage: node examples/dither-light/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const dither = (colors, scale = 1.4, extra = {}) => ({ name: 'dither', colors, scale, ...extra });
const LAYOUT = {
  landscape: { plinth: [1040, 760, 680, 120], phone: [1200, 300, 280, 470], sphere: [1600, 660, 100], name: [200, 470], line: [200, 560], size: 120 },
  vertical: { plinth: [240, 1300, 600, 120], phone: [400, 840, 280, 470], sphere: [790, 1180, 120], name: [540, 420], line: [540, 510], size: 120 },
};
for (const shape of ['landscape', 'vertical']) {
  const L = LAYOUT[shape], tallFrame = shape === 'vertical';
  const [px, py, pw, ph] = L.phone, [bx, by, bw, bh] = L.plinth, [sx, sy, sr] = L.sphere;
  const storyboard = {
    version: 2,
    title: 'Dither light',
    logline: 'A small product, lit one pixel at a time in two inks.',
    format: { preset: shape, fps: 30 },
    theme: 'lcd', type: 'geometric', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'product', block: 'stage', hold: 1.6,
        vo: 'Meet Pocket. Small enough to carry everywhere, simple enough to need nothing else.',
        props: {
          ground: { material: 'dither', colors: ['accent2', 'ink'], scale: 2.4, speed: 0.6, opacity: 1 },
          camera: { keys: [{ at: 0, zoom: 1, dur: 0 }, { at: 0.2, zoom: 1.05, dur: 6, ease: 'inOut' }] },
          elements: [
            { type: 'rect', x: bx, y: by, w: bw, h: bh, r: 8, fill: 'accent2', material: dither(['surface', 'accent2'], 1.4, { speed: 0.6 }), enter: 'none', at: 0 },
            { type: 'circle', cx: sx, cy: sy, r: sr, fill: 'bg', material: dither(['bg', 'accent2'], 1.2, { speed: 0.6 }), enter: 'rise', say: 'Small', dur: 0.8 },
            { type: 'rect', x: px, y: py, w: pw, h: ph, r: 40, fill: 'bg', material: dither(['bg', 'accent2'], 1.2, { speed: 0.6 }), enter: 'rise', say: 'Pocket', dur: 0.9 },
            { type: 'rect', x: px + 26, y: py + 60, w: pw - 52, h: ph - 150, r: 14, fill: 'ink', material: dither(['accent2', 'ink'], 1, { speed: 0.6, amount: 0.4 }), enter: 'fade', say: 'Pocket', dur: 0.9 },
            { type: 'circle', cx: px + pw / 2, cy: py + ph - 46, r: 18, fill: 'ink', enter: 'fade', say: 'Pocket', dur: 0.9 },
            { type: 'text', text: 'Pocket', x: L.name[0], y: L.name[1], size: L.size, font: 'mono', fill: 'bg', anchor: tallFrame ? 'middle' : 'start', enter: 'type', say: 'Pocket' },
            { type: 'text', text: 'Carry less.', x: L.line[0], y: L.line[1], size: 52, font: 'mono', fill: 'bg', anchor: tallFrame ? 'middle' : 'start', enter: 'fade', say: 'nothing', dur: 0.6 },
          ],
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
