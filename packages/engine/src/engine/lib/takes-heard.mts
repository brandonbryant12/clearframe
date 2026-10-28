// Word timings for several takes in one local Whisper pass, mapped onto each take's script.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { timedWords } from './ingest.mjs';
import { transcribeEach, whisperAvailable, whisperWavs } from './whisper.mjs';
import { wordsHeard } from './whisper/alignment.mjs';
import { alignScript } from './word-align.mjs';
import type { ScriptAlignment } from './word-align.mjs';

/** Each take's script alignment (null when it was not heard) and the recognizer that heard them. */
export interface HeardTakes {
  aligned: (ScriptAlignment | null)[];
  provider: string | null;
}

/**
 * Word timings for several takes in one local Whisper run (the model loads once), each take
 * heard on its own clock and mapped onto its script. Takes are never joined with silence: the
 * recognizer collapsed the first words after each gap onto one instant.
 */
export async function heardWordsMany(
  files: readonly string[],
  tokenLists: readonly (readonly string[])[],
  language: string | undefined,
): Promise<HeardTakes> {
  const unheard: HeardTakes = {
    aligned: files.map(() => null),
    provider: null,
  };
  if (!files.length || !whisperAvailable()) return unheard;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-takew-'));
  try {
    const wavs = await whisperWavs(files, tmp);
    process.stderr.write(
      `  measuring words with local Whisper (about a minute per minute of speech without whisper.cpp; longer while other work runs)…\n`,
    );
    let heardEach: ReturnType<typeof transcribeEach>;
    try {
      heardEach = transcribeEach(wavs, {
        language: language ?? 'en',
        dir: tmp,
      });
    } catch {
      return unheard;
    }
    const aligned = files.map((_, i) => {
      const heard = heardEach[i];
      return heard && wordsHeard(heard.words)
        ? alignScript(tokenLists[i], timedWords(heard.words))
        : null;
    });
    return { aligned, provider: heardEach[0]?.provider ?? null };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
