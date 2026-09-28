// Regenerate the README images from the current renderer. Run through codex-heavy:
//   /Users/brandon/.local/bin/codex-heavy -- node scripts/docs-media.mjs
// Writes docs/media/{blocks.jpg, blocks-vertical.jpg, looks.png, data-story.jpg}.
import fs from 'node:fs';
import path from 'node:path';
import { writeGallery, scaffold } from '../fframes/playbooks.mjs';
import { sheetProject, lookbookProject } from '../fframes/production.mjs';
import { ffmpeg } from '../engine/lib/util.mjs';

const work = path.resolve('build/docs-media');
const media = path.resolve('docs/media');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(media, { recursive: true });
const jpeg = (from, to, width) => ffmpeg(['-y', '-i', from, '-vf', `scale=${width}:-2`, '-q:v', '3', '-frames:v', '1', to]);

const landscape = path.join(work, 'landscape');
await writeGallery(landscape, { theme: 'paper' });
await jpeg(await sheetProject(landscape, { draft: true, per: 1, columns: 4, thumb: 480 }), path.join(media, 'blocks.jpg'), 1800);

const vertical = path.join(work, 'vertical');
await writeGallery(vertical, { vertical: true, theme: 'ink' });
await jpeg(await sheetProject(vertical, { draft: true, per: 1, columns: 8, thumb: 240 }), path.join(media, 'blocks-vertical.jpg'), 1600);

// The same donut frame in all eight palettes.
fs.copyFileSync(await lookbookProject(landscape, { beat: 'donut', pos: 0.8, draft: true }), path.join(media, 'looks.png'));

const story = path.join(work, 'data-story');
scaffold(story, { playbook: 'data-story' });
await jpeg(await sheetProject(story, { draft: true, per: 1, columns: 3, thumb: 560 }), path.join(media, 'data-story.jpg'), 1500);
console.log(`Updated ${media}`);
