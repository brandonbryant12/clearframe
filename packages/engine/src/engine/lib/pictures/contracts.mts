import type { CanvasElement } from '../../../film/types.mjs';

/** A sketch name (or null with a recipe in `use`) and why it fits the line. */
export interface PictureFit {
  sketch: string | null;
  why: string;
  use: string | undefined;
}

export type PictureMatcher =
  | RegExp
  | readonly RegExp[]
  | ((text: string) => boolean);

export type PictureRule = readonly [
  PictureMatcher,
  string | null,
  string,
  string?,
];

/** One figure a line says, with the word its value lands on. */
export interface SpokenFigure {
  value: number;
  say: string;
  prefix: string;
  suffix: string;
}

/** Spoken-number normalisation (`spokenNumbers` in film/): words in, figures as text out. */
export type Spoken = (words: string[]) => string;

export interface ChartSuggestion {
  kind: 'number' | 'bars';
  prefix?: string;
  suffix?: string;
  values: { label: string; value: number; say: string }[];
}

export interface CastObject extends Required<Pick<CanvasElement, 'shape'>> {
  id: string;
  color: string;
  size: number;
  label?: string;
  enter?: string;
}

export interface CastFormation {
  form: string;
  ids: string[];
  say?: string;
  at?: number;
  beside?: string;
  to?: string;
  into?: string;
}

export interface CastSuggestion {
  cast: { fresh: true; objects: CastObject[]; formations: CastFormation[] };
}
