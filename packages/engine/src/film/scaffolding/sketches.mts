import * as Schema from 'effect/Schema';
import { ArtSchema } from '../../engine/schemas.mjs';
import type { FramePreset } from '../sketch-kit.mjs';
import type {
  PlaybookItem,
  StoryboardBeat,
  CanvasElement,
  BlockProps,
  SketchDrawing,
} from '../types.mjs';
import type { Storyboard } from '../../engine/domain.mjs';

import type { LibraryRef } from '../directions.mjs';

import {
  sketch,
  sketchByName,
  expandArt,
  SKETCH_FRAMES as SKETCH_SIZE,
} from '../sketches.mjs';

import type { ScaffoldOptions } from './contracts.mjs';

export const sketchCameraKeys: (
  | 'view'
  | 'viewFrom'
  | 'viewDur'
  | 'dolly'
  | 'focus'
)[] = ['view', 'viewFrom', 'viewDur', 'dolly', 'focus'];

export function playbookFrame(
  format: string | undefined,
  vertical = false,
): FramePreset {
  if (vertical || format === 'vertical') return 'vertical';
  if (format === 'square' || format === 'portrait') return format;
  return 'landscape';
}

export function copySketchCamera<K extends (typeof sketchCameraKeys)[number]>(
  props: BlockProps,
  drawn: SketchDrawing,
  key: K,
): void {
  props[key] = drawn[key];
}

/** Library refs for the art sketches a storyboard names, so shared ones travel with it. */
export const artSketches = (sb: Storyboard): LibraryRef[] =>
  sb.beats.flatMap((b) => (b.art?.sketch ? [['sketches', b.art.sketch]] : []));

export function redrawBeat(
  b: StoryboardBeat,
  book: PlaybookItem,
  { vertical, seed }: ScaffoldOptions,
  index: number,
): void {
  // A composition that cannot survive the crop is authored again for the tall frame: a beat's
  // `tall` props replace its own in a vertical scaffold (frame pixels of 1080×1920).
  if (b.tall) {
    if (vertical || book.format === 'vertical')
      b.props = { ...b.props, ...b.tall };
    delete b.tall;
  }
  // A beat's art layer can name a sketch too: `art: {sketch: "ambient"}` (its own layer).
  // It is checked now but kept as shorthand: the job expands it at the final frame size and
  // beat duration (voice can set that later), and scaffold vendors shared sketches.
  checkArtSketch(b, book, vertical, seed);
  const props = (b.props ??= {});
  const name = props.sketch;
  // A system-diagram sketch stays declarative: its diagram compiles for the real frame and
  // remains editable (ids, steps, labels) instead of becoming hundreds of drawn shapes.
  const diagram = name && sketchByName(name)?.diagram;
  if (diagram) {
    props.diagram ??= structuredClone(diagram);
    delete props.sketch;
    return;
  }
  // A fill-in-the-blank sketch (`keep: true`) stays a short reference with its words, moments
  // and numbers to fill; the job draws it for the real frame. Copying hundreds of drawn shapes
  // into the storyboard would bury the slots an author is meant to fill.
  if (name && sketchByName(name)?.keep) return;
  if (!name) {
    // Diagrams, casts and charts lay themselves out for the frame; a landscape view would squeeze them.
    const responsiveKeys: (keyof BlockProps)[] = [
      'diagram',
      'cast',
      'plot',
      'bars',
      'bridge',
      'breakdown',
      'process',
      'decision',
      'table',
      'stat',
      'multiples',
      'distribution',
      'kpi',
      'teaching',
    ];
    if (responsiveKeys.some((k) => props[k] != null)) return;
    if (
      (vertical || book.format === 'vertical') &&
      b.block === 'canvas' &&
      props &&
      props.view == null
    )
      props.view = [1920, 1080];
    return;
  }
  redrawSketch(
    props,
    name,
    vertical || book.format === 'vertical',
    seed,
    index,
  );
}

function checkArtSketch(
  b: StoryboardBeat,
  book: PlaybookItem,
  vertical: boolean | undefined,
  seed: number | undefined,
) {
  if (b.art?.sketch) {
    const [width, height] = SKETCH_SIZE[playbookFrame(book.format, vertical)];
    if (b.art.seed == null && seed != null) b.art = { ...b.art, seed };
    expandArt(Schema.decodeUnknownSync(ArtSchema)(b.art), { width, height });
  }
}

export function redrawSketch(
  props: BlockProps,
  name: string,
  tallFrame: boolean,
  seed: number | undefined,
  index: number,
): void {
  // Each sketch beat gets its own seeded layout, so two films never share a skyline.
  const drawn = sketch(name, tallFrame ? 'vertical' : 'landscape', {
    seed: seed == null ? undefined : seed + index * 101,
    say: props.sketchSay,
    params: props.sketchParams,
  });
  delete props.sketchSay;
  delete props.sketchParams;
  if (tallFrame || !props.elements) props.elements = drawn.elements;
  // Placeholder type in a sketch ("TITLE") is replaced by the playbook's words.
  const words = props.sketchText ?? {};
  const retext = (list: CanvasElement[]): void =>
    list.forEach((el) => {
      if (el.type === 'text' && el.text !== undefined && words[el.text] != null)
        el.text = words[el.text];
      if (el.children) retext(el.children);
    });
  retext(props.elements);
  delete props.sketchText;
  for (const k of sketchCameraKeys)
    if (drawn[k] == null) {
      // An authored "auto" fits the sketch to the space the scene leaves it.
      if (!(k === 'view' && props.view === 'auto')) delete props[k];
    } else if (tallFrame || props[k] == null) copySketchCamera(props, drawn, k);
  delete props.sketch;
  delete props.stagger;
}
