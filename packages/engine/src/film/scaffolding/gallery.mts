import type { CanvasElement } from '../types.mjs';

import { decodeStoryboard } from '../../engine/schemas.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, palette } from '../catalog.mjs';
import { writeJSON, ffmpeg } from '../../engine/lib/util.mjs';
import { wireframePNG } from '../wireframe.mjs';
import { sketches, sketch } from '../sketches.mjs';

import type { GalleryOptions } from './contracts.mjs';
import { storyboardFor } from './storyboard.mjs';
import { sketchCameraKeys } from './sketches.mjs';

export const GALLERY_SECONDS = {
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
} satisfies Partial<Record<string, number>>;

/** The last timed cue in a sketch's elements (children included), in seconds. */
export function lastCue(elements: CanvasElement[] = []): number {
  return elements.reduce(
    (end, el) =>
      Math.max(
        end,
        (el.at ?? 0) + (el.dur ?? 0),
        el.exitAt ?? 0,
        lastCue(el.children),
      ),
    0,
  );
}

/** Every canvas sketch as its own beat (ambient sketches sit under a statement), long enough
 *  for its last cue to settle. */
export function sketchGallery({
  vertical = false,
  theme = 'paper',
  only,
}: GalleryOptions = {}) {
  const sb = storyboardFor('concept-explainer', { theme, vertical });
  sb.title = 'Canvas sketches';
  // Sketches that count up their sample figures still need a visible source.
  sb.sources = [{ id: 'sample', title: 'Illustrative sample figures' }];
  sb.beats = sketches()
    .filter((s) => !only || only.includes(s.name))
    .map((s) => {
      const props = sketch(s.name, vertical ? 'vertical' : 'landscape');
      const duration = Math.max(5, Math.ceil(lastCue(props.elements) + 1.5));
      return props.layer === 'under'
        ? {
            id: s.name,
            block: 'statement',
            duration,
            art: { under: props.elements },
            props: { text: 'A held frame that still breathes.' },
          }
        : {
            id: s.name,
            block: 'canvas',
            duration,
            props: {
              kicker: 'Sketch',
              title: s.name[0].toUpperCase() + s.name.slice(1),
              elements: props.elements,
              source: 'Illustrative sample figures',
              ...Object.fromEntries(
                sketchCameraKeys
                  .filter((k) => props[k] != null)
                  .map((k) => [k, props[k]]),
              ),
            },
          };
    });
  return sb;
}

export async function writeGallery(
  dir: string,
  {
    vertical = false,
    theme = 'paper',
    only,
    sketches = false,
  }: GalleryOptions = {},
) {
  if (fs.existsSync(path.join(dir, 'storyboard.json')))
    throw new Error(
      'Gallery destination already contains a storyboard; choose a fresh directory.',
    );
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
  sb.beats = decodeStoryboard({
    ...sb,
    beats: BLOCKS.filter((b) => !only || only.includes(b.name)).map((b) => ({
      id: b.name,
      block: b.name,
      duration:
        Object.entries(GALLERY_SECONDS).find(
          ([name]) => name === b.name,
        )?.[1] ?? 4,
      ...(b.vo ? { vo: b.vo } : {}),
      props: {
        ...structuredClone(b.example),
        ...(['image', 'annotate'].includes(b.name)
          ? { file: 'assets/demo.png' }
          : {}),
      },
    })),
  }).beats;
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return sb;
}
