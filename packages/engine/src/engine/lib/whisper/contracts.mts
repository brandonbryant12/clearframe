/** A word whisper.cpp heard, in seconds. */
export interface HeardWord {
  word: string;
  start: number;
  end: number;
}

/** The Python CLI's JSON: words inside segments (read by `timedWords`); other fields are kept. */
export interface WhisperTranscript {
  readonly segments?: readonly {
    readonly words?: readonly unknown[];
    readonly [key: string]: unknown;
  }[];
  readonly [key: string]: unknown;
}

export interface HeardTranscript {
  words: HeardWord[] | WhisperTranscript;
  provider: string;
}

export interface TranscribeWordsOptions {
  model?: string | undefined;
  language?: string | undefined;
  dir: string;
}

/** A narrated beat with a current take on disk. */
export interface Take {
  id: string;
  vo: string;
  wav: string;
  metaFile: string;
}

export interface AlignReport {
  id: string;
  status: string;
}

export interface WhisperAlignOptions {
  beat?: string | undefined;
  model?: string | undefined;
  language?: string | undefined;
  force?: boolean | undefined;
}
