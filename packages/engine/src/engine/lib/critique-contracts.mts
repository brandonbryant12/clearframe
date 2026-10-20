import type {
  Beat,
  BlockProps,
  ResolvedStoryboard,
  TimedBeat,
  Timing,
  JsonObject,
} from '../domain.mjs';
export interface CritiqueBeat extends Beat {
  _stage?: string;
  _stageFirst?: JsonObject | null;
  _cast?: boolean;
  _words?: number;
}
export interface CritiqueFinding {
  level: 'error' | 'warn' | 'idea';
  where: string;
  message: string;
}
export interface CritiqueContext {
  root: string;
  sb: ResolvedStoryboard;
  timing: Timing;
  beats: CritiqueBeat[];
  t: TimedBeat[];
  add: (
    level: CritiqueFinding['level'],
    where: string,
    message: string,
  ) => void;
}
export interface FilmTell {
  name: string;
  fix: string;
}

export interface BeatCheckContext extends CritiqueContext {
  b: CritiqueBeat;
  i: number;
  d: number;
  words: number;
  authored: BlockProps | undefined;
}
