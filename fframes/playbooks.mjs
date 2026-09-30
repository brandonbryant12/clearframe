import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, palette } from './catalog.mjs';
import { writeJSON, ffmpeg } from '../engine/lib/util.mjs';
import { wireframePNG } from './wireframe.mjs';
import { sketches, sketch } from './sketches.mjs';
import { items, vendor } from './library.mjs';
import { applyTreatment, directionTemplate, treatmentById } from './treatments.mjs';

// Playbooks: starting story arcs, one JSON file each in library/playbooks (plus any in a
// project's library/). A beat that names a `sketch` is redrawn for the requested frame.
export const playbooks = () => items('playbooks');

export function storyboardFor(id, { title, theme, vertical } = {}) {
  const book = playbooks().find(p => p.id === id);
  if (!book) throw new Error(`Unknown playbook ${id}`);
  const sb = {
    version: 2,
    title: title ?? book.title,
    logline: book.title,
    format: { preset: vertical ? 'vertical' : (book.format ?? 'landscape'), fps: 30 },
    theme: theme ?? book.theme ?? 'paper',
    motion: { preset: book.motion ?? 'gentle', intensity: 0.65 },
    transition: 'fade',
    backdrop: book.backdrop ?? 'none',
    chrome: false,
    captions: book.captions ?? false,
    music: false,
    ...(book.texture ? { texture: book.texture } : {}),
    ...(book.frame ? { frame: book.frame } : {}),
    ...(book.speakers ? { speakers: book.speakers } : {}),
    ...(book.voice ? { voice: book.voice } : {}),
    sources: [{ id: 'sample', title: 'Hypothetical sample data and fictional quotations — replace before publishing' }],
    continuity: {
      maxGeneratedShare: 0.2,
      treatment: 'Restrained editorial graphics, generous space, no generated text',
      camera: 'Locked or a slow push',
      lighting: 'Soft, diffuse',
      motion: 'Slow left-to-right movement',
    },
    beats: structuredClone(book.beats),
  };
  // Sketch coordinates are frame pixels: re-draw them for the requested frame.
  for (const b of sb.beats) {
    const name = b.props?.sketch;
    if (!name) continue;
    if (vertical || book.format === 'vertical') b.props.elements = sketch(name, 'vertical').elements;
    delete b.props.sketch;
    delete b.props.view;
    delete b.props.stagger;
  }
  const ids = new Map();
  for (const b of sb.beats) {
    const n = (ids.get(b.id) ?? 0) + 1;
    ids.set(b.id, n);
    if (n > 1) b.id += `-${n}`;
  }
  palette(sb.theme);
  return sb;
}
export function scaffold(dir, options = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} is not empty`);
  const id = options.playbook ?? options.recipe ?? 'concept-explainer',
    sb = storyboardFor(id, options),
    book = playbooks().find(p => p.id === id);
  if (options.treatment) {
    applyTreatment(sb, options.treatment);
    if (options.theme) sb.theme = options.theme;
  }
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  vendor(dir, [
    ['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base],
    ['treatments', options.treatment],
  ]);
  fs.writeFileSync(
    path.join(dir, 'DIRECTION.md'),
    directionTemplate(sb, options.treatment ? treatmentById(options.treatment) : null),
  );
  // Placeholder screenshots are generated locally: text-free, palette-matched and clearly illustrative.
  if (sb.beats.some(b => b.props?.file === 'assets/screen.png')) {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets/screen.png'), wireframePNG(palette(sb.theme)));
  }
  fs.writeFileSync(
    path.join(dir, 'BRIEF.md'),
    `# ${sb.title}\n\nPlaybook: ${id}\nAudience: ${book.audience}\nRequired inputs: ${book.inputs}\n\n${book.note ?? ''}\n\nReplace all sample claims and sources. Choose a palette and motion intensity in storyboard.json. The playbook is a starting structure: add, remove or reorder native blocks to serve the story.\n`,
  );
  return sb;
}
const GALLERY_SECONDS = {
  kinetic: 6,
  breathing: 8,
  cycle: 8,
  highlight: 5,
  donut: 5,
  magnitude: 5,
  checklist: 5,
  annotate: 6,
  kpis: 5,
  waffle: 5,
  delta: 5,
  canvas: 5,
};
/** Every canvas sketch as its own beat (ambient sketches sit under a statement). */
export function sketchGallery({ vertical = false, theme = 'paper', only } = {}) {
  const sb = storyboardFor('concept-explainer', { theme, vertical });
  sb.title = 'Canvas sketches';
  sb.backdrop = 'glow';
  sb.beats = sketches()
    .filter(s => !only || only.includes(s.name))
    .map(s => {
      const props = sketch(s.name, vertical ? 'vertical' : 'landscape');
      return props.layer === 'under'
        ? {
            id: s.name,
            block: 'statement',
            duration: 5,
            art: { under: props.elements },
            props: { text: 'A held frame that still breathes.' },
          }
        : {
            id: s.name,
            block: 'canvas',
            duration: 5,
            props: { kicker: 'Sketch', title: s.name[0].toUpperCase() + s.name.slice(1), elements: props.elements },
          };
    });
  return sb;
}
export async function writeGallery(dir, { vertical = false, theme = 'paper', only, sketches = false } = {}) {
  if (fs.existsSync(path.join(dir, 'storyboard.json')))
    throw new Error('Gallery destination already contains a storyboard; choose a fresh directory.');
  if (sketches) {
    fs.mkdirSync(dir, { recursive: true });
    const sb = sketchGallery({ vertical, theme, only });
    writeJSON(path.join(dir, 'storyboard.json'), sb);
    return sb;
  }
  const colors = palette(theme);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${colors.surface}:s=960x540:r=30:d=4`,
    '-vf',
    `drawbox=x=100:y=120:w=240:h=240:color=${colors.accent}:t=fill`,
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '1',
    '-pix_fmt',
    'yuv420p',
    path.join(dir, 'assets/demo.mp4'),
  ]);
  fs.writeFileSync(path.join(dir, 'assets/demo.png'), wireframePNG(colors));
  const sb = storyboardFor('concept-explainer', { theme, vertical });
  sb.title = 'Native building blocks';
  sb.beats = BLOCKS.filter(b => !only || only.includes(b.name)).map(b => ({
    id: b.name,
    block: b.name,
    duration: GALLERY_SECONDS[b.name] ?? 4,
    ...(b.vo ? { vo: b.vo } : {}),
    props: {
      ...structuredClone(b.example),
      ...(['image', 'annotate'].includes(b.name) ? { file: 'assets/demo.png' } : {}),
    },
  }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return sb;
}
