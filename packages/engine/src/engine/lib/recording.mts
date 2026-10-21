// Recording edits: cut words, sentences and pauses out of an imported recording, split and
// merge its beats, and undo any of it. A beat's audio is a declared view of the untouched
// master (source/recording.wav): its frame-aligned span minus removed sample ranges, rebuilt
// from the master on every change. So an edit can be undone exactly, and measured word
// timings stay measured: kept words move by exact sample counts, nothing is re-estimated.
// Removals sit inside pauses and are whole frames long, so beats still tile the timeline.
export {
  SOURCE,
  isRecorded,
  readEdits,
  editParts,
  editBeatIds,
  wasOf,
} from './recording-model.mjs';
export type {
  AuthoredBeat,
  EditAuthor,
  EditEntry,
  EditPart,
  RecordedMeta,
  RecordingSlice,
  Removal,
  Transcript,
  TranscriptWord,
  VoMeta,
} from './recording-model.mjs';
export {
  loadSource,
  masterState,
  ensureTranscript,
  spanFrames,
  slicePieces,
  sourceSegments,
  keptWords,
  slicePCM,
  sliceProblem,
  sourceTime,
} from './recording-slices.mjs';
export type {
  Clock,
  KeptWord,
  MasterState,
  Piece,
  SegmentMap,
  SourceAudio,
} from './recording-slices.mjs';
export {
  planRemoval,
  planPause,
  findPhrase,
  sentenceAround,
} from './recording-select.mjs';
export type { FilmWord, Selection, WordPos } from './recording-select.mjs';
export { atomically } from './recording-context.mjs';
export {
  cutWords,
  identitiesOf,
  cutAll,
  tightenPauses,
} from './recording-cut.mjs';
export type { CutPart, CutReport, EditOptions } from './recording-cut.mjs';
export { uncut, splitBeat, mergeBeats } from './recording-beats.mjs';
