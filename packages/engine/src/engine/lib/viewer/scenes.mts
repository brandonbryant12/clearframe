import fs from 'node:fs';
import path from 'node:path';
import type { Beat, Storyboard } from '../../domain.mjs';
import type { FontRegistry, FontEntry } from './files.mjs';
import type {
  ViewerScene,
  SceneElement,
  PreparedTextElement,
  ViewerPreparedJob,
  ViewerTimeline,
} from './contracts.mjs';
import type { FaceSet } from '../../../film/type.mjs';
import { FONT_DIR, slug, rel, frameAt } from './media.mjs';
import { isRecord } from '../harness/contracts.mjs';
/** Canvas font names → bundled files (mirrors text_font in scene/native/src/blocks/canvas_geometry.rs). */
export const FONT_FILES = {
  text: 'Inter-Regular.ttf',
  regular: 'Inter-Regular.ttf',
  strong: 'Inter-SemiBold.ttf',
  light: 'InterDisplay-Light.ttf',
  bold: 'InterDisplay-Bold.ttf',
  figures: 'InterDisplay-Figures.ttf',
  display: 'InterDisplay-SemiBold.ttf',
  semibold: 'InterDisplay-SemiBold.ttf',
  serif: 'InstrumentSerif-Regular.ttf',
  'serif-italic': 'InstrumentSerif-Italic.ttf',
  italic: 'InstrumentSerif-Italic.ttf',
  mono: 'IBMPlexMono-Medium.ttf',
  hand: 'ArchitectsDaughter-Regular.ttf',
  poster: 'BebasNeue-Regular.ttf',
  'serif-display': 'DMSerifDisplay-Regular.ttf',
  'serif-display-italic': 'DMSerifDisplay-Italic.ttf',
  didone: 'PlayfairDisplay-Bold.ttf',
  'didone-italic': 'PlayfairDisplay-BoldItalic.ttf',
  wide: 'ArchivoExpanded-ExtraBold.ttf',
  geometric: 'SpaceGrotesk-Bold.ttf',
  'geometric-light': 'SpaceGrotesk-Light.ttf',
  condensed: 'BigShouldersDisplay-ExtraBold.ttf',
};
export const bundled = (
  fonts: FontRegistry,
  file: string,
): FontEntry | null | undefined =>
  fonts.add(path.join(FONT_DIR, file), {
    license: 'OFL-1.1',
    origin: 'ClearFrame',
  });
/** The font a canvas text element draws with (unnamed text: display when large, else body). */
export function elementFont(el: PreparedTextElement) {
  const file = Object.entries(FONT_FILES).find(
    ([name]) => name === el.font,
  )?.[1];
  if (file) return file;
  if (el.count) return FONT_FILES.figures;
  return (el.size ?? 48) >= 40 ? FONT_FILES.display : FONT_FILES.text;
}

/** Where a text element sits on the frame, from its baseline position, size, width and anchor. */
export function elementText(el: PreparedTextElement): string {
  if (typeof el.count === 'object')
    return `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}`;
  return String(el.count ?? el.text ?? '');
}

export function textBox(el: PreparedTextElement) {
  const x0 = el.x ?? 0,
    y0 = el.y ?? 0;
  const size = el.size ?? 48,
    text = elementText(el);
  if (el.width && el.height) return [x0, y0 - size * 0.82, el.width, el.height];
  // Average advance: uppercase and figures run wider than mixed-case text; tracking adds per letter.
  let advance = 0.52;
  if (el.font === 'figures' || el.count) advance = 0.6;
  if (el.upper || (text === text.toUpperCase() && /[A-Z]/.test(text)))
    advance = 0.66;
  const w = Math.min(
    el.fit ?? Infinity,
    text.length * size * (advance + (el.tracking ?? 0)),
  );
  let x = x0;
  if (el.anchor === 'middle') x -= w / 2;
  if (el.anchor === 'end') x -= w;
  return [x, y0 - size * 0.82, w, size * 1.05];
}

export function describeBeat(b: Beat): {
  kind: string;
  onScreen: string[];
  source: string | null;
} {
  const CHART = {
    stat: 'Headline figure',
    plot: 'Line chart',
    bars: 'Bar chart',
    bridge: 'Bridge chart',
    cast: 'Cast',
    distribution: 'Distribution',
    multiples: 'Small multiples',
    chart: 'Chart',
    teaching: 'Question',
    sketch: 'Illustration',
  };
  const KIND = {
    title: 'Title card',
    endcard: 'End card',
    statement: 'Statement',
    quote: 'Quote',
    video: 'Video clip',
    image: 'Image',
    kinetic: 'Moving type',
    chapter: 'Chapter card',
  };
  const props = b.props ?? {},
    chart = Object.keys(CHART).find((k) => props[k] != null),
    candidate = chart ? props[chart] : props,
    spec = isRecord(candidate) ? candidate : {};
  const onScreen = [
    spec?.kicker,
    spec?.title,
    spec?.label,
    props.support,
  ].filter((t): t is string => typeof t === 'string' && !!t.trim());
  const known =
    Object.entries(CHART).find(([name]) => name === chart)?.[1] ??
    Object.entries(KIND).find(([name]) => name === b.block)?.[1];
  const fallback =
    b.block === 'canvas'
      ? 'Graphic'
      : (b.block ?? 'scene').replace(/^\w/, (c) => c.toUpperCase());
  return {
    kind: known ?? fallback,
    onScreen: [...new Set(onScreen)].slice(0, 3),
    source:
      typeof spec.source === 'string' ? spec.source : (props.source ?? null),
  };
}

/** Media a storyboard beat places: image and clip assets, prepared files, plates. */
export function beatMedia(b: Beat, sb: Storyboard, dir: string) {
  const ids = new Set<string>(),
    files = new Set<string>();
  JSON.stringify(b.props ?? {}, (k, v) => {
    if (['asset', 'plates', 'image'].includes(k) && typeof v === 'string')
      ids.add(v);
    if (k === 'file' && typeof v === 'string') files.add(v);
    return v;
  });
  for (const id of ids) {
    const a = (sb.assets ?? []).find((x) => x.id === id);
    const f =
      a?.file ??
      [
        `assets/img/${id}.jpg`,
        `assets/img/${id}.png`,
        `assets/clips/${id}.mp4`,
      ].find((p) => fs.existsSync(path.join(dir, p)));
    if (f) files.add(f);
  }
  return [...files];
}

type UseFont = (file: string, role: string) => ReturnType<FontRegistry['add']>;
function sceneElements(
  elementsToRead: PreparedTextElement[],
  b: Beat,
  theme: Record<string, string>,
  start: number,
  use: UseFont,
): SceneElement[] {
  const elements: SceneElement[] = [];
  for (const el of elementsToRead) {
    if (el.type !== 'text' || !String(el.text ?? '').trim()) continue;
    const f = use(
      elementFont(el),
      ['title', 'endcard'].includes(b.block ?? '')
        ? 'Titles and headlines'
        : 'Graphics and charts',
    );
    const fill = typeof el.fill === 'string' ? el.fill : 'ink';
    elements.push({
      id: el.id,
      text: elementText(el),
      font: f?.id ?? null,
      size: Math.round(el.size ?? 48),
      color: {
        token: fill,
        hex: theme[fill] ?? (fill.startsWith('#') ? fill : (theme.ink ?? null)),
      },
      box: textBox(el).map((n) => Math.round(n)),
      at: start + (el.at ?? 0),
    });
  }
  return elements;
}

interface SceneBuild {
  sb: Storyboard;
  job: ViewerPreparedJob | null;
  timeline: ViewerTimeline | null;
  fps: number;
  video: string;
  media: string;
  prefix: string;
  out: string;
  dir: string;
  faces: FaceSet;
  theme: Record<string, string>;
  use: UseFont;
}
export function buildScenes({
  sb: vsb,
  job,
  timeline,
  fps,
  video,
  media,
  prefix,
  out,
  dir,
  faces,
  theme,
  use,
}: SceneBuild) {
  const narration: { start: number; end: number; text: string }[] = [],
    sceneList: ViewerScene[] = [];
  let t = 0;
  for (const [k, b] of (vsb.beats ?? []).entries()) {
    const jb = job?.beats?.find((x) => x.id === b.id),
      tb = timeline?.beats?.find((x) => x.id === b.id);
    const start = jb ? jb.start_frame / fps : (tb?.start ?? t),
      end = jb
        ? (jb.start_frame + jb.frames) / fps
        : (tb?.end ?? t + (b.duration ?? 4));
    t = end;
    for (const c of jb?.captions ?? [])
      narration.push({
        start: start + c.start,
        end: start + c.end,
        text: c.text,
      });
    const elements = sceneElements(
      jb?.props?.elements ?? [],
      b,
      theme,
      start,
      use,
    );
    if (
      ['title', 'endcard', 'statement', 'quote', 'chapter', 'kinetic'].includes(
        b.block ?? '',
      )
    ) {
      use(faces.bold, 'Titles and headlines');
      use(faces.regular, 'Titles and headlines');
    }
    const thumb = frameAt(
      video,
      media,
      `${prefix}-scene-${slug(b.id)}`,
      end - 0.35,
      480,
    );
    sceneList.push({
      number: k + 1,
      id: b.id,
      start,
      end,
      ...describeBeat(b),
      narration: b.vo ?? null,
      placeholder: b.placeholder ?? null,
      elements,
      thumb: thumb && rel(out, thumb),
      media: beatMedia(b, vsb, dir),
    });
  }
  return { narration, sceneList };
}
