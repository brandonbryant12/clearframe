import type {
  CanvasElement,
  ElementKey,
  CueResolver,
  Point,
} from '../types.mjs';

export interface CastPose {
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  z?: number;
  gone?: boolean;
  quiet?: boolean;
  hero?: boolean;
  filled?: CastPose;
}
export interface CastObject {
  id: string;
  icon?: string;
  word?: string;
  ['shape']?: string;
  color?: string;
  label?: string;
  size?: number;
  float?: boolean;
  enter?: string;
}
export interface CastFormation {
  form: string;
  say?: string;
  at?: number;
  ids?: string[];
  hero?: string;
  word?: string;
  center?: Point;
  spread?: number;
  scale?: number;
  dur?: number;
  stagger?: number;
  ease?: string;
  thread?: boolean;
  beside?: string;
  on?: string;
  out?: string;
  in?: string;
  by?: string[];
  mark?: string;
  to?: string | string[];
  color?: string;
  zoom?: number;
  into?: string;
  from?: string;
  via?: Point[];
  trail?: boolean;
}
export interface CastInput {
  objects?: CastObject[];
  formations: CastFormation[];
  seed?: number;
  look?: string;
  fresh?: boolean;
}
export interface CastSpec {
  objects: Map<string, CastObject>;
  formations: CastFormation[];
  seed: number;
  look: string;
}
export interface CastCamera {
  x: number;
  y: number;
  zoom: number;
}
export interface CastEdges {
  fill?: string;
  emerge?: string;
}
export interface CastCarry {
  state?: Map<string, CastPose>;
  objects?: Map<string, CastObject>;
  threads?: CanvasElement[];
  look?: string;
  camera?: CastCamera;
  unit?: number;
  edges?: Record<string, CastEdges>;
}
export interface CastFrame {
  width: number;
  height: number;
  top?: number;
  bottom?: number;
  duration?: number;
  beatId?: string;
}
export interface CastContext extends CastCarry {
  cue?: CueResolver;
  heading?: string;
  captions?: boolean;
  carry?: CastCarry;
  notes?: string[];
}
export interface CastOptions {
  state?: Map<string, CastPose>;
  threads?: CanvasElement[];
  camera?: CastCamera;
  unit?: number;
  cue?: CueResolver;
}
export interface CastGroup extends CanvasElement {
  type: 'group';
  id: string;
  keys: ElementKey[];
  children: CanvasElement[];
}
export interface ObjectGroup {
  el: CastGroup;
  base: CastPose;
}
export interface CastDrawing {
  body: { x: number; y: number; w: number; h: number; r: number };
  details: (CanvasElement & { body?: boolean })[];
}
export interface ObjectDefinition {
  about: string;
  extent: Point;
  draw: (size: number, detail: string, color?: string) => CastDrawing;
}
export interface CastLook {
  about: string;
  tile: (size: number) => Partial<CanvasElement>;
  mark: (object: CastObject) => string;
  font: string;
  label: string;
  shadow: boolean;
}
export interface FormationOptions {
  size: number;
  seed?: number;
  current?: Map<string, CastPose>;
  extent?: (id: string) => Point;
  below?: (id: string) => number;
}
export interface CastStage {
  spec: CastSpec;
  frame: CastFrame;
  state: Map<string, CastPose>;
  camera: CastCamera;
  cam: CastCamera;
  camKeys: ElementKey[];
  size: number;
  u: number;
  pose: Map<string, CastPose>;
  groups: Map<string, ObjectGroup>;
  elements: CanvasElement[];
  words: CanvasElement[];
  notes: string[];
  edges: CastEdges;
  under: CanvasElement[];
  carried: CanvasElement[];
  top: number;
  times: number[];
  group: (id: string) => ObjectGroup;
  release: (at: number) => void;
  until: (index: number) => number | undefined;
  alive: (id: string) => boolean;
}
export interface CastStep {
  f: CastFormation;
  k: number;
  t: number;
  stagger: number;
  dur: number;
  ids: string[];
}
