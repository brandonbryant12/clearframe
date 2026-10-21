import {
  Fields,
  numeric,
  text,
  words,
  listOf,
  flag,
  oneOf,
} from './00-boundary.js';
// Films as the page reads them: from the built page, `/api/films` and `/api/studio/film`, plus
// the notes and the new-film form this browser keeps. Each model holds only what the page reads;
// the server's own contracts (engine/lib/viewer/contracts.mts) are wider.

export interface Spot {
  x: number;
  y: number;
}
interface FilmStage {
  id: string;
  label: string;
  next?: string | null;
}
interface SceneElement {
  id?: string | null;
  text?: string | null;
  box?: number[] | null;
  at?: number | null;
}
export interface Scene {
  number: number;
  id: string;
  start: number;
  end: number;
  kind: string;
  onScreen?: string[] | null;
  narration?: string | null;
  placeholder?: string | null;
  elements?: SceneElement[] | null;
  thumb?: string | null;
}
/** A scene before the first cut: a still and its words. */
export interface Board {
  id: string;
  number: number;
  kind: string;
  seconds: number;
  image?: string | null;
  placeholder?: string | null;
  onScreen?: string[] | null;
  narration?: string | null;
}
/** A note saved in the film's review record, as the server shows it. */
export interface SavedNote {
  id: string;
  text: string;
  by?: string | null;
  at?: number | null;
  status?: string | null;
  resolved?: boolean | null;
  changedIn?: string | null;
  answer?: string | null;
  pin?: Spot | null;
  on?: string | null;
  element?: string | null;
  earlier?: string | null;
  earlierAt?: number | null;
  scene?: string | null;
}
interface Approval {
  by?: string | null;
  said?: string | null;
}
export interface Version {
  id: string;
  number: number;
  createdAt: string;
  video: string;
  seconds?: number | null;
  poster?: string | null;
  frame?: { width: number; height: number } | null;
  scenes?: Scene[] | null;
  notes?: SavedNote[] | null;
  approved?: Approval | null;
}
export interface Film {
  id: string;
  kind: string;
  title: string;
  folder: string;
  updatedAt: string;
  versions: Version[];
  /** The film's frame: the server's `shape` (wide, tall, square), used as a style class. */
  aspect: string;
  boards?: Board[] | null;
  brief?: string | null;
  notesTo?: string | null;
  stage?: FilmStage | null;
  /** The project's files by name (`source/…`, `assets/uploads/…`). */
  files?: { name: string }[] | null;
}
interface ViewerData {
  roots: string[];
  films: Film[];
}
export interface FilmListing extends ViewerData {
  projects?: string | null;
}
/** What the first message needs to know about a film just made. */
export type MadeFilm = Pick<Film, 'title' | 'files'>;
interface MadeProject {
  id: string;
  film?: MadeFilm | null;
}

// ---------------------------------------------------------------- notes and the form kept in this browser

type LocalState = 'open' | 'done' | 'removed';
/** A note on a board or a loose cut, kept in this browser rather than in the film. */
export interface LocalNote {
  id: string;
  text: string;
  state: LocalState;
  version?: string | null;
  at?: number | null;
  scene?: string | null;
  spot?: Spot | null;
  on?: string | null;
  element?: string | null;
  by?: string | null;
  createdAt?: string | null;
}
/** The new-film form, saved as it is typed so a refresh (or a create cut short) keeps it. */
export interface FilmForm {
  request?: string | null;
  submission?: string | null;
  started?: boolean | null;
  mode?: string | null;
  format?: string | null;
  idea?: string | null;
  title?: string | null;
  playbook?: string | null;
  treatment?: string | null;
  audience?: string | null;
  takeaway?: string | null;
  documents?: string[] | null;
}

function decodeSpot(input: unknown, at: string): Spot {
  const r = Fields.of(input, at);
  return { x: r.req('x', numeric), y: r.req('y', numeric) };
}
/** A placeholder is a description, `{ text }`, or `true`; the page shows its words. */
function placeholderWords(input: unknown, at: string): string | null {
  if (typeof input === 'string') return input;
  if (typeof input === 'boolean') return input ? 'true' : null;
  return Fields.of(input, at).req('text', text);
}
function decodeElement(input: unknown, at: string): SceneElement {
  const r = Fields.of(input, at);
  return {
    id: r.opt('id', text),
    text: r.opt('text', words),
    box: r.opt('box', listOf(numeric)),
    at: r.opt('at', numeric),
  };
}
function decodeScene(input: unknown, at: string): Scene {
  const r = Fields.of(input, at);
  return {
    number: r.req('number', numeric),
    id: r.req('id', text),
    start: r.req('start', numeric),
    end: r.req('end', numeric),
    kind: r.req('kind', text),
    onScreen: r.opt('onScreen', listOf(words)),
    narration: r.opt('narration', text),
    placeholder: r.opt('placeholder', placeholderWords),
    elements: r.opt('elements', listOf(decodeElement)),
    thumb: r.opt('thumb', text),
  };
}
function decodeBoard(input: unknown, at: string): Board {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    number: r.req('number', numeric),
    kind: r.req('kind', text),
    seconds: r.req('seconds', numeric),
    image: r.opt('image', text),
    placeholder: r.opt('placeholder', placeholderWords),
    onScreen: r.opt('onScreen', listOf(words)),
    narration: r.opt('narration', text),
  };
}
export function decodeSavedNote(input: unknown, at: string): SavedNote {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    text: r.req('text', text),
    by: r.opt('by', text),
    at: r.opt('at', numeric),
    status: r.opt('status', text),
    resolved: r.opt('resolved', flag),
    changedIn: r.opt('changedIn', text),
    answer: r.opt('answer', text),
    pin: r.opt('pin', decodeSpot),
    on: r.opt('on', text),
    element: r.opt('element', text),
    earlier: r.opt('earlier', text),
    earlierAt: r.opt('earlierAt', numeric),
    scene: r.opt('scene', text),
  };
}
function decodeFrame(
  input: unknown,
  at: string,
): { width: number; height: number } {
  const r = Fields.of(input, at);
  return { width: r.req('width', numeric), height: r.req('height', numeric) };
}
function decodeApproval(input: unknown, at: string): Approval {
  const r = Fields.of(input, at);
  return { by: r.opt('by', text), said: r.opt('said', text) };
}
function decodeVersion(input: unknown, at: string): Version {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    number: r.req('number', numeric),
    createdAt: r.req('createdAt', text),
    video: r.req('video', text),
    seconds: r.opt('seconds', numeric),
    poster: r.opt('poster', text),
    frame: r.opt('frame', decodeFrame),
    scenes: r.opt('scenes', listOf(decodeScene)),
    notes: r.opt('notes', listOf(decodeSavedNote)),
    approved: r.opt('approved', decodeApproval),
  };
}
function decodeStage(input: unknown, at: string): FilmStage {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    label: r.req('label', text),
    next: r.opt('next', text),
  };
}
function decodeFileName(input: unknown, at: string): { name: string } {
  return { name: Fields.of(input, at).req('name', text) };
}
function decodeFilm(input: unknown, at: string): Film {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    kind: r.req('kind', text),
    title: r.req('title', text),
    folder: r.req('folder', text),
    aspect: r.req('shape', text),
    updatedAt: r.req('updatedAt', text),
    versions: r.req('versions', listOf(decodeVersion)),
    boards: r.opt('boards', listOf(decodeBoard)),
    brief: r.opt('brief', text),
    notesTo: r.opt('notesTo', text),
    stage: r.opt('stage', decodeStage),
    files: r.opt('files', listOf(decodeFileName)),
  };
}
/** The page's films, written into it when it was built. */
export function decodeViewerData(input: unknown, at: string): ViewerData {
  const r = Fields.of(input, at);
  return {
    roots: r.req('roots', listOf(text)),
    films: r.req('films', listOf(decodeFilm)),
  };
}
export function decodeFilmListing(input: unknown, at: string): FilmListing {
  const r = Fields.of(input, at);
  return { ...decodeViewerData(input, at), projects: r.opt('projects', text) };
}
/** `/api/studio/film`: one film rebuilt now, or nothing when the server has none to show. */
export function decodeFreshFilm(input: unknown, at: string): Film | null {
  return input === null ? null : decodeFilm(input, at);
}
export function decodeMadeProject(input: unknown, at: string): MadeProject {
  const r = Fields.of(input, at);
  const film = (x: unknown, where: string): MadeFilm => {
    const f = Fields.of(x, where);
    return {
      title: f.req('title', text),
      files: f.opt('files', listOf(decodeFileName)),
    };
  };
  return { id: r.req('id', text), film: r.opt('film', film) };
}
/** `/api/upload`: the name the file was saved under in the draft. */
export function decodeUpload(input: unknown, at: string): string {
  return Fields.of(input, at).req('file', text);
}
export function decodeLocalNote(input: unknown, at: string): LocalNote {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    text: r.req('text', text),
    state: r.req('state', oneOf(['open', 'done', 'removed'])),
    version: r.opt('version', text),
    at: r.opt('at', numeric),
    scene: r.opt('scene', text),
    spot: r.opt('spot', decodeSpot),
    on: r.opt('on', text),
    element: r.opt('element', text),
    by: r.opt('by', text),
    createdAt: r.opt('createdAt', text),
  };
}
export function decodeFilmForm(input: unknown, at: string): FilmForm {
  const r = Fields.of(input, at);
  return {
    request: r.opt('request', text),
    submission: r.opt('submission', text),
    started: r.opt('started', flag),
    mode: r.opt('mode', text),
    format: r.opt('format', text),
    idea: r.opt('idea', text),
    title: r.opt('title', text),
    playbook: r.opt('playbook', text),
    treatment: r.opt('treatment', text),
    audience: r.opt('audience', text),
    takeaway: r.opt('takeaway', text),
    documents: r.opt('documents', listOf(text)),
  };
}
