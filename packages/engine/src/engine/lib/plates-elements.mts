// Canvas elements that stage a depth-plate set (far, mid, near) for one frame.
import { LAYER_DEPTH } from './plates-layers.mjs';
import type { AlphaBounds, PlateLayer } from './plates-layers.mjs';

/** Where the mid layer's subject was placed: its centre, the line it stands on, and its width. */
export interface PlateStaging {
  cx: number;
  base: number;
  span: number;
}
/** An asset as plate staging reads it: where its subject sits, what it stands on. */
export interface StagedPlateAsset {
  id: string;
  bounds?: AlphaBounds | null | undefined;
  ground?: string | undefined;
  staged?: PlateStaging | undefined;
}
export interface PlateFrame {
  w: number;
  h: number;
  layers?: readonly PlateLayer[] | undefined;
  assets?: readonly StagedPlateAsset[] | undefined;
}

interface PlateKey {
  at: number;
  dur: number;
  scaleY?: number;
  x?: number;
  ease?: string;
  hold?: boolean;
}
interface PlateCue {
  z: number;
  at: number;
  enter?: string;
  dur?: number;
  opacity?: number;
  blur?: number;
}
export interface PlateImage extends PlateCue {
  type: 'image';
  asset: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fit: 'cover' | 'contain';
  origin?: [number, number];
  keys?: PlateKey[];
  treatment?: string;
  loop?: { type: 'float'; period: number; amount: number };
}
export interface PlateEllipse extends PlateCue {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string | { gradient: [string, string]; radial: boolean; fade: boolean };
}
export interface PlateRect extends PlateCue {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  fill: string;
}
export interface PlateLine extends PlateCue {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  width: number;
  cap: 'round';
  keys: PlateKey[];
}
export type PlateElement = PlateImage | PlateEllipse | PlateRect | PlateLine;

const r = (v: number): number => Math.round(v * 10) / 10;
type Box = [number, number, number, number];

/** The far layer is oversized so camera moves never show its edge. */
const farLayer = (id: string, w: number, h: number): PlateImage => ({
  type: 'image',
  asset: `${id}-far`,
  x: Math.round(-w * 0.08),
  y: Math.round(-h * 0.08),
  w: Math.round(w * 1.16),
  h: Math.round(h * 1.16),
  fit: 'cover',
  z: LAYER_DEPTH.far,
  at: 0,
  dur: 0,
});

/** The near layer frames the edges, soft with nearness. */
const nearLayer = (id: string, w: number, h: number): PlateImage => ({
  type: 'image',
  asset: `${id}-near`,
  x: Math.round(-w * 0.06),
  y: Math.round(-h * 0.06),
  w: Math.round(w * 1.12),
  h: Math.round(h * 1.12),
  fit: 'cover',
  z: LAYER_DEPTH.near,
  blur: 3,
  at: 0,
  dur: 0,
});

/**
 * Stage the subject from where it sits in its cut-out: its base at three quarters of the frame
 * height (above any letterbox, with room for its shadow or reflection), no wider than 70% of the
 * frame, drifted toward the centre. Records the staging on the asset and returns the layer's box.
 */
function stageSubject(
  mid: StagedPlateAsset,
  bounds: AlphaBounds,
  w: number,
  h: number,
): Box {
  const [iw, ih] = bounds.size,
    k = Math.min(w / iw, h / ih),
    [dx, dy] = [(w - iw * k) / 2, (h - ih * k) / 2],
    [bx0, by0, bx1, by1] = bounds.box;
  const left = dx + bx0 * iw * k,
    right = dx + bx1 * iw * k,
    top = dy + by0 * ih * k,
    foot = dy + by1 * ih * k,
    sx = (left + right) / 2;
  const s = Math.min(
    1,
    (w * 0.7) / (right - left),
    (h * 0.58) / Math.max(1, foot - top),
  );
  const tx = w / 2 + (sx - w / 2) * 0.5,
    ty = h * 0.76;
  mid.staged = { cx: tx, base: ty, span: (right - left) * s };
  return [tx - sx * s, ty - foot * s, w * s, h * s];
}

/** On water: the cut-out mirrored about its waterline, dim and soft. */
const reflection = (
  id: string,
  box: Box,
  { cx, base, span }: PlateStaging,
): PlateImage => ({
  type: 'image',
  asset: `${id}-mid`,
  x: r(box[0]),
  y: r(box[1]),
  w: r(box[2]),
  h: r(box[3]),
  fit: 'contain',
  z: LAYER_DEPTH.mid,
  opacity: 0.4,
  blur: 3,
  origin: [r(cx), r(base - span * 0.012)],
  keys: [{ at: 0, scaleY: -0.7, dur: 0 }],
  at: 0,
  enter: 'fade',
  dur: 0.6,
});

/** A soft contact shadow where the subject meets the ground (fainter on water). */
const contactShadow = (
  { cx, base, span }: PlateStaging,
  water: boolean,
): PlateEllipse => ({
  type: 'ellipse',
  cx: r(cx),
  cy: r(base - span * 0.01),
  rx: r(span * 0.56),
  ry: r(Math.max(6, span * 0.035)),
  fill: '#000000',
  opacity: water ? 0.3 : 0.5,
  blur: r(Math.max(6, span * 0.02)),
  z: LAYER_DEPTH.mid,
  at: 0,
  enter: 'none',
});

/**
 * The subject itself, tinted toward the film's palette, so a subject generated in its own light
 * sits in the painting's light; afloat, it rides the swell.
 */
function subjectLayer(
  id: string,
  box: Box,
  mid: StagedPlateAsset | undefined,
): PlateImage {
  const afloat = mid?.ground === 'water' ? mid.staged : undefined;
  const swell: Pick<PlateImage, 'origin' | 'loop'> = afloat
    ? {
        origin: [r(afloat.cx), r(afloat.base)],
        loop: { type: 'float', period: 4.5, amount: 5 },
      }
    : {};
  return {
    type: 'image',
    asset: `${id}-mid`,
    x: r(box[0]),
    y: r(box[1]),
    w: r(box[2]),
    h: r(box[3]),
    fit: 'contain',
    z: LAYER_DEPTH.mid,
    treatment: 'tint',
    ...swell,
    at: 0,
    enter: 'none',
  };
}

/** On water the hull sits in it: haze, the water's tone over its foot, and drifting waterlines. */
function waterline({ cx, base, span }: PlateStaging): PlateElement[] {
  const haze: PlateEllipse = {
    type: 'ellipse',
    cx: r(cx),
    cy: r(base),
    rx: r(span * 0.62),
    ry: r(Math.max(10, span * 0.045)),
    fill: { gradient: ['bg', 'bg'], radial: true, fade: true },
    opacity: 0.9,
    z: LAYER_DEPTH.mid,
    at: 0,
    enter: 'none',
  };
  // The hull's foot is under water: the water's tone rises over its last few pixels.
  const tones = [-0.05, -0.04, -0.032].map((dy, i): PlateRect => ({
    type: 'rect',
    x: r(cx - span * 0.47),
    y: r(base + span * dy),
    w: r(span * 0.94),
    h: r(span * 0.04),
    r: r(span * 0.02),
    fill: 'bg',
    opacity: [0.25, 0.45, 0.7][i],
    blur: r(span * 0.012),
    z: LAYER_DEPTH.mid,
    at: 0,
    enter: 'none',
  }));
  // The waterline: thin lines of reflected sky crossing the hull's foot, drifting slowly.
  const lines = [-0.03, -0.02, -0.008, 0.006].map((dy, i): PlateLine => ({
    type: 'line',
    x1: r(cx - span * (0.55 - i * 0.06)),
    y1: r(base + span * dy),
    x2: r(cx + span * (0.5 - i * 0.05)),
    y2: r(base + span * dy),
    stroke: 'ink',
    width: Math.max(1, r(span * 0.003)),
    opacity: r(0.2 - i * 0.04),
    cap: 'round',
    z: LAYER_DEPTH.mid,
    // A slow sideways drift (sway would tilt the line).
    keys: [
      {
        at: 0,
        x: (i % 2 ? -1 : 1) * span * 0.04,
        dur: 10,
        ease: 'linear',
        hold: false,
      },
    ],
    at: 0,
    enter: 'none',
  }));
  return [haze, ...tones, ...lines];
}

/** The mid layer: its reflection and shadow (once staged), the subject, then the water over its foot. */
function midLayer(
  id: string,
  w: number,
  h: number,
  mid: StagedPlateAsset | undefined,
): PlateElement[] {
  const box: Box = mid?.bounds
    ? stageSubject(mid, mid.bounds, w, h)
    : [0, 0, w, h];
  const staged = mid?.staged;
  const water = mid?.ground === 'water';
  const out: PlateElement[] = [];
  if (staged) {
    if (water) out.push(reflection(id, box, staged));
    out.push(contactShadow(staged, water));
  }
  out.push(subjectLayer(id, box, mid));
  if (staged && water) out.push(...waterline(staged));
  return out;
}

/**
 * Canvas elements that stage a plate set in depth for a `w`×`h` frame: the far layer is
 * oversized so camera moves never show its edge; the near layer is soft with nearness.
 */
export function plateElements(
  id: string,
  { w, h, layers = ['far', 'mid', 'near'], assets = [] }: PlateFrame,
): PlateElement[] {
  const mid = assets.find((a) => a.id === `${id}-mid`);
  const out: PlateElement[] = [];
  if (layers.includes('far')) out.push(farLayer(id, w, h));
  if (layers.includes('mid')) out.push(...midLayer(id, w, h, mid));
  // Staging is recorded on the mid asset even when its layer is not drawn.
  else if (mid?.bounds) stageSubject(mid, mid.bounds, w, h);
  if (layers.includes('near')) out.push(nearLayer(id, w, h));
  return out;
}
