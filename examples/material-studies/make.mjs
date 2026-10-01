// Regenerate the three editable showcase storyboards; no image generation required.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
// The professional family pushes in gently; the playful and arena families travel further.
const families = [
  ['material-studies', 'daylight', 0.5, ['lightwell','contour-field','paper-fold','glass-orbits']],
  ['material-play', 'sorbet', 0.8, ['bubble-cluster','ribbon-wave','petal-burst','inflated-loop']],
  ['material-arena', 'neon', 0.8, ['arena-grid','prism-shards']],
];
const tall = process.argv.includes('--vertical');
for (const [name, theme, drift, sketches] of families) {
  const dir = tall ? path.resolve(root, '../../build/material-vertical', name) : path.resolve(root, '..', name);
  fs.mkdirSync(dir, { recursive: true });
  const x = tall ? 84 : 140, y = tall ? 170 : 385;
  const sb = {
    version: 2, title: name.replaceAll('-', ' '),
    format: { preset: tall ? 'vertical' : 'landscape', fps: 30 }, theme,
    motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    camera: 'none', captions: false, frame: false, sfx: 'off', music: false,
    beats: sketches.map((sketch, i) => ({
      id: sketch, block: 'canvas', duration: 3.2, camera: 'none',
      art: { sketch, seed: 17 + i, drift },
      props: { elements: [
        { type: 'text', text: theme === 'neon' ? 'AFTER HOURS' : theme === 'sorbet' ? 'SOFT ENERGY' : 'DAYLIGHT STUDIO', x, y: y - 95, size: 23, tracking: 0.12, font: 'mono', fill: 'muted', at: 0, enter: 'fade', dur: 0.35 },
        { type: 'text', text: sketch.replaceAll('-', '\n'), x, y, size: tall ? 82 : 96, width: tall ? 880 : 840, height: 260, font: 'bold', fill: 'ink', at: 0, enter: 'rise', dur: 0.6 },
        { type: 'text', text: 'FORM / LIGHT / MOTION', x, y: y + 265, size: 22, tracking: 0.06, font: 'mono', fill: 'accent', at: 0.3, enter: 'fade', dur: 0.5 },
      ] },
    })),
  };
  delete sb.camera;
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb, null, 2) + '\n');
}
