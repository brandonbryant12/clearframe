import type { FontRegistry } from './files.mjs';
import type { Beat, Element, Storyboard } from '../../domain.mjs';

export interface BuildContext {
  out: string;
  media: string;
  fonts: FontRegistry;
  render?: boolean;
}
export interface Pin {
  x?: number;
  y?: number;
  on?: string;
  element?: string;
}
export interface NoteRecord {
  id: string;
  text: string;
  status?: string;
  version?: string;
  revision?: string;
  createdAt?: string;
  by?: string | null;
  author?: string | { name?: string };
  scope?: string;
  at?: number | null;
  element?: string | null;
  pin?: Pin | null;
  anchor?: { at?: number; element?: string } | null;
  resolution?: { revision?: string; summary?: string };
  replies?: { text: string; by?: string | null; at?: string | null }[];
  history?: { status: string; at: string; by?: unknown }[];
}
export interface ViewerNote {
  id: string;
  text: string;
  by: string | null;
  createdAt: string | null;
  at: number | null;
  scope: string;
  element: string | null;
  pin: { x: number; y: number } | null;
  where: string | null;
  on: string | null;
  status: string;
  changedIn: string | null;
  answer: string | null;
  resolved: boolean;
  state: string;
  tags: string[];
  replies: { text: string; by: string | null; at: string | null }[];
  version?: string;
  earlier?: string;
  earlierAt?: number | null;
}
export interface SceneElement {
  id?: string;
  text?: string;
  font: string | null;
  size: number | null;
  color: { token: string | null; hex: string | null };
  box?: number[];
  at: number;
}
export interface ViewerScene {
  number: number;
  id: string;
  start: number;
  end: number;
  kind: string;
  onScreen: string[];
  source: string | null;
  narration: string | null;
  placeholder?: Beat['placeholder'] | null;
  description?: string | null;
  elements: SceneElement[];
  thumb: string | null;
  media: string[];
}
export interface StoryBoardFrame {
  number: number;
  id: string;
  seconds: number;
  kind: string;
  onScreen: string[];
  source: string | null;
  narration: string | null;
  placeholder: Beat['placeholder'] | null;
  image: string | null;
}
export interface ViewerLanes {
  narration: { start: number; end: number; text: string }[];
  music: { start: number; end: number | null; name: string; asset?: string }[];
  sfx: { t: number; name: string }[];
}
export interface ViewerVersion {
  id: string;
  number: number;
  profile?: string;
  placeholders?: unknown[];
  label: string | null;
  createdAt: string;
  seconds: number | null;
  quality: string;
  approved: { by: string | null; said: string | null } | null;
  notes: ViewerNote[];
  video: string;
  poster: string | null;
  frame: { width: number; height: number };
  colors: Record<string, string>;
  scenes: ViewerScene[];
  lanes: ViewerLanes;
  fonts: { font: string; roles: string[] }[];
  look: {
    palette?: Storyboard['theme'];
    type?: string;
    format?: string;
    fps?: number;
  };
}
export interface ViewerStage {
  id: string;
  label: string;
  phase: string;
  index: number;
  next: string;
}
export interface ViewerFile {
  name: string;
  type: string;
  group: string;
  path: string;
  size: number;
  seconds?: number | null;
  wave?: string | null;
  poster?: string | null;
  preview?: string;
  font?: string | null;
}
export interface ViewerFilm {
  id: string;
  kind: string;
  title: string;
  folder: string;
  ['shape']: string;
  beats: number;
  versions: ViewerVersion[];
  files: ViewerFile[];
  notesTo: string | null;
  about?: string | null;
  stage: ViewerStage;
  brief: string | null;
  boards: StoryBoardFrame[];
  updatedAt: string;
}
export interface PreparedTextElement extends Element {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  upper?: boolean;
  fit?: number;
  tracking?: number;
  anchor?: string;
}
export interface ViewerPreparedJob {
  fps?: number;
  width?: number;
  height?: number;
  theme?: Record<string, string>;
  type?: { id?: string; display?: string; emphasis?: string };
  beats?: {
    id: string;
    start_frame: number;
    frames: number;
    captions?: { start: number; end: number; text: string }[];
    props?: { elements?: PreparedTextElement[] };
  }[];
}
export interface ViewerRevision {
  id: string;
  inputs?: Record<string, string>;
  job?: string;
  duration?: number;
  placeholders?: unknown[];
  label?: string;
  createdAt: string;
}
export interface ViewerTimeline {
  fps?: number;
  beats?: { id: string; start: number; end: number }[];
}
export interface ViewerDecision {
  action?: string;
  revision?: string;
  by?: string;
  said?: string;
  role?: string;
}
export interface VersionContext extends BuildContext {
  notes: NoteRecord[];
  decisions: ViewerDecision[];
  pins: Record<string, Pin>;
  film: string;
  title: string;
}
