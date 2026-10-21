import type { Word } from '../domain.mjs';

import { wordKey } from './word-timing.mjs';

const FILLERS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm'];

const PHRASES = [
  ['you', 'know'],
  ['i', 'mean'],
  ['sort', 'of'],
  ['kind', 'of'],
];

/** Mechanical candidates only: filler words, doubled words, long pauses. Proposals, never applied. */
export interface PaperBeat {
  id: string;
  words: Word[];
}

export interface CutSuggestion {
  beat: string;
  at: number;
  words: string;
  why: string;
  pause?: boolean;
}

export function suggestCuts(beats: PaperBeat[]): CutSuggestion[] {
  const out: CutSuggestion[] = [];
  for (const b of beats) {
    const keys = b.words.map((w) => wordKey(w.w));
    keys.forEach((k, i) => {
      if (FILLERS.includes(k))
        out.push({
          beat: b.id,
          at: b.words[i].t0,
          words: b.words[i].w,
          why: 'filler word',
        });
      if (i && k && k === keys[i - 1] && !FILLERS.includes(k))
        out.push({
          beat: b.id,
          at: b.words[i].t0,
          words: `${b.words[i - 1].w} ${b.words[i].w}`,
          why: 'doubled word (cut one)',
        });
      for (const p of PHRASES)
        if (
          p.every((x, j) => keys[i + j] === x) &&
          (i === 0 || /[,.]$/.test(b.words[i - 1].w))
        )
          out.push({
            beat: b.id,
            at: b.words[i].t0,
            words: b.words
              .slice(i, i + p.length)
              .map((w) => w.w)
              .join(' '),
            why: 'verbal filler',
          });
      if (i && b.words[i].t0 - b.words[i - 1].t1 > 1.2)
        out.push({
          beat: b.id,
          at: b.words[i - 1].t1,
          words: '',
          why: `${(b.words[i].t0 - b.words[i - 1].t1).toFixed(1)} s pause`,
          pause: true,
        });
    });
  }
  return out;
}
