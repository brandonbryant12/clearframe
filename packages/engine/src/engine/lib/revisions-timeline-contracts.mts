import type { RecordedMeta, Transcript, VoMeta } from './recording-model.mjs';
import type {
  FilmPrints,
  JobBeat,
  PreparedContext,
} from './revisions-model.mjs';
import type { Beat, Source, TimedBeat } from '../domain.mjs';

export interface Recorded {
  meta: RecordedMeta;
  transcript: Transcript;
}

export interface Shared {
  root: string;
  ctx: PreparedContext;
  film: FilmPrints;
  jobFilm: Record<string, unknown>;
  sources: Source[];
  sourceSha: string | null;
  transcript: Transcript | null;
}

/** One beat as the timeline reads it: prepared, timed, authored, and its narration's metadata. */
export interface BeatInputs {
  jb: JobBeat;
  i: number;
  tb: TimedBeat;
  b: Partial<Beat>;
  meta: VoMeta | null;
  recorded: Recorded | null;
}
