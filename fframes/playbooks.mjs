import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, palette } from './catalog.mjs';
import { writeJSON, ffmpeg } from '../engine/lib/util.mjs';
import { wireframePNG } from './wireframe.mjs';
import { sketches, sketch, sketchByName, expandArt, SKETCH_FRAMES as SKETCH_SIZE } from './sketches.mjs';
import { items, vendor } from './library.mjs';
import { muse, museMarkdown } from './muse.mjs';
import { applyTreatment, directionTemplate, treatmentById } from './treatments.mjs';
import { directionOptions, directionMarkdown, directionRefs } from './directions.mjs';

// Playbooks: starting story arcs, one JSON file each in library/playbooks (plus any in a
// project's library/). A beat that names a `sketch` is redrawn for the requested frame.
export const playbooks = () => items('playbooks');

export function storyboardFor(id, { title, theme, vertical, seed } = {}) {
  const book = playbooks().find(p => p.id === id);
  if (!book) throw new Error(`Unknown playbook ${id}`);
  const sb = {
    version: 2,
    title: title ?? book.title,
    logline: book.title,
    format: { preset: vertical ? 'vertical' : (book.format ?? 'landscape'), fps: 30 },
    theme: theme ?? book.theme ?? 'paper',
    motion: { preset: book.motion ?? 'gentle', intensity: 0.65 },
    transition: book.transition ?? 'fade',
    backdrop: book.backdrop ?? 'none',
    chrome: false,
    captions: book.captions ?? false,
    // A produced film has a score and sound that follows the picture: a draft bed is free
    // (music --draft); the final bed is paid and runs only after plan and approval.
    music: book.music ?? {},
    sfx: book.sfx ?? 'subtle',
    ...(book.texture ? { texture: book.texture } : {}),
    ...(book.lens ? { lens: book.lens } : {}),
    ...(book.camera ? { camera: book.camera } : {}),
    ...(book.heading ? { heading: book.heading } : {}),
    ...(book.textMotion ? { textMotion: book.textMotion } : {}),
    ...(book.type ? { type: book.type } : {}),
    ...(book.sfx ? { sfx: book.sfx } : {}),
    ...(book.frame ? { frame: book.frame } : {}),
    ...(book.speakers ? { speakers: book.speakers } : {}),
    ...(book.voice ? { voice: book.voice } : {}),
    sources: structuredClone(book.sources ?? [{ id: 'sample', title: 'Hypothetical sample data and fictional quotations — replace before publishing' }]),
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
  // A sketch's own camera (view, truck, dolly, focus) travels with it. A canvas drawn in
  // landscape frame pixels is fitted whole into a tall frame rather than cropped off-centre.
  for (const b of sb.beats) {
    // A beat's art layer can name a sketch too: `art: {sketch: "ambient"}` (its own layer).
    // It is checked now but kept as shorthand: the job expands it at the final frame size and
    // beat duration (voice can set that later), and scaffold vendors shared sketches.
    if (b.art?.sketch) {
      const [width, height] = SKETCH_SIZE[vertical ? 'vertical' : (book.format ?? 'landscape')] ?? SKETCH_SIZE.landscape;
      if (b.art.seed == null && seed != null) b.art = { ...b.art, seed };
      expandArt(b.art, { width, height });
    }
    const name = b.props?.sketch;
    // A system-diagram sketch stays declarative: its diagram compiles for the real frame and
    // remains editable (ids, steps, labels) instead of becoming hundreds of drawn shapes.
    const diagram = name && sketchByName(name)?.diagram;
    if (diagram) {
      b.props.diagram ??= structuredClone(diagram);
      delete b.props.sketch;
      continue;
    }
    if (!name) {
      // A diagram lays itself out for the frame; a landscape view would squeeze it.
      if (b.props?.diagram) continue;
      if ((vertical || book.format === 'vertical') && b.block === 'canvas' && b.props && b.props.view == null)
        b.props.view = [1920, 1080];
      continue;
    }
    const tallFrame = vertical || book.format === 'vertical';
    // Each sketch beat gets its own seeded layout, so two films never share a skyline.
    const drawn = sketch(name, tallFrame ? 'vertical' : 'landscape', {
      seed: seed == null ? undefined : seed + sb.beats.indexOf(b) * 101,
    });
    if (tallFrame || !b.props.elements) b.props.elements = drawn.elements;
    // Placeholder type in a sketch ("TITLE") is replaced by the playbook's words.
    const words = b.props.sketchText ?? {};
    const retext = list =>
      list.forEach(el => {
        if (el.type === 'text' && words[el.text] != null) el.text = words[el.text];
        if (el.children) retext(el.children);
      });
    retext(b.props.elements);
    delete b.props.sketchText;
    for (const k of ['view', 'viewFrom', 'viewDur', 'dolly', 'focus'])
      if (drawn[k] == null) {
        // An authored "auto" fits the sketch to the space the scene leaves it.
        if (!(k === 'view' && b.props.view === 'auto')) delete b.props[k];
      } else if (tallFrame || b.props[k] == null) b.props[k] = drawn[k];
    delete b.props.sketch;
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
/** Library refs for the art sketches a storyboard names, so shared ones travel with it. */
export const artSketches = sb => sb.beats.filter(b => b.art?.sketch).map(b => ['sketches', b.art.sketch]);
export function scaffold(dir, options = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} is not empty`);
  options = directionOptions(options);
  const id =
      options.playbook ??
      options.recipe ??
      (options.treatment && treatmentById(options.treatment)?.playbook) ??
      'concept-explainer',
    sb = storyboardFor(id, options),
    book = playbooks().find(p => p.id === id);
  if (options.treatment) {
    applyTreatment(sb, options.treatment);
    if (options.theme) sb.theme = options.theme;
  }
  // A creative seed varies the look on top of the arc and treatment, and briefs the director.
  const drawn = options.seed != null ? muse(options.seed) : null;
  if (drawn) {
    if (!options.theme) sb.theme = drawn.palette;
    sb.lens = {
      gradeAmount: 0.45,
      bloom: 0.25,
      blur: 0.5,
      ...(sb.lens ?? {}),
      grade: drawn.grade,
      ...drawn.apply.lens,
    };
    sb.textMotion = drawn.textMotion;
    sb.transition = drawn.apply.transition;
  }
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  vendor(dir, [
    ['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base],
    ['treatments', options.treatment],
    ['types', sb.type],
    ...directionRefs(options.direction, [['treatments', options.treatment], ['playbooks', id]]),
    ...artSketches(sb),
  ]);
  fs.writeFileSync(
    path.join(dir, 'DIRECTION.md'),
    directionTemplate(sb, options.treatment ? treatmentById(options.treatment) : null) +
      directionMarkdown(options.direction) +
      (drawn ? `\n${museMarkdown(drawn)}` : ''),
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
            props: { kicker: 'Sketch', title: s.name[0].toUpperCase() + s.name.slice(1), elements: props.elements,
              ...Object.fromEntries(['view', 'viewFrom', 'viewDur', 'dolly', 'focus'].filter(k => props[k] != null).map(k => [k, props[k]])) },
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
