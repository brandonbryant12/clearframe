import type { Word } from '../domain.mjs';
/** An estimated word was interpolated, rather than heard by the recognizer. */
export interface AlignedWord extends Word {
  estimated?: boolean;
}
export interface ScriptAlignment {
  words: AlignedWord[];
  interpolated: number;
  matched: number;
}
export interface ScriptToken {
  w: string;
  key: string;
}
export interface HeardToken extends AlignedWord {
  key: string;
}
