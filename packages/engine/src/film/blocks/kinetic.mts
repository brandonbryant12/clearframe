import { b } from './definition.mjs';

export const kineticBlock = b(
  'kinetic',
  'speech',
  'Speech-following words: highlight a phrase, reveal words, one at a time, or stack them as poster type that builds as spoken.',
  {
    mode: 'highlight|reveal|word|stack',
    align: 'left|center (stack defaults to center)',
    emphasis:
      'stack: words drawn larger in the accent (whole words from the narration)',
    emphasisStyle: 'stack: bold (default) or serif italic emphasis words',
    upper: 'stack: set in capitals (true/false)',
    maxWords:
      'Words per phrase (1–16; stack pages whole sentences, up to 14 words, by default)',
    maxGap: 'Start a new phrase after this silence, 0–5 seconds (default 0.6)',
    maxDuration:
      'Maximum phrase span, 0.5–15 seconds (default 4); never split a timed word',
  },
  { mode: 'highlight', align: 'left', maxWords: 6, source: '' },
  { vo: 'Make every word land exactly when you hear it.' },
);
