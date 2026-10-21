import type { DirectionOptions } from '../directions.mjs';

export interface ScaffoldOptions extends DirectionOptions {
  title?: string;
  theme?: string | Record<string, string>;
  vertical?: boolean;
  seed?: number;
  ending?: string;
  length?: number;
}

export interface GalleryOptions {
  vertical?: boolean;
  theme?: string;
  only?: string[];
  sketches?: boolean;
}
