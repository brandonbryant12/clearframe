// How fast each voice actually reads. After a real take, the words-per-minute that makes
// the draft estimate match the measured take is remembered per model, voice and style, so
// drafts of the next film are timed like the final instead of at a generic 150 wpm.
import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import { cacheRoot } from './cache.mjs';
import { estimateDuration } from './timing.mjs';

/** The parts of a voice setup that change how fast it reads. */
export interface VoiceRateKey {
  model?: string;
  voice?: string;
  style?: string;
}
interface VoiceRate {
  wpm: number;
  n: number;
  updated: string;
}
type VoiceRates = Record<string, VoiceRate>;

const VoiceRatesSchema: Schema.Codec<VoiceRates> = Schema.Record(
  Schema.String,
  Schema.Struct({
    wpm: Schema.Finite,
    n: Schema.Finite,
    updated: Schema.String,
  }),
);
const decodeRates = Schema.decodeUnknownSync(VoiceRatesSchema);

const FILE =
  process.env.CF_VOICE_RATES ?? path.join(cacheRoot(), 'voice-rates.json');
const key = (v: VoiceRateKey): string =>
  [v.model ?? '', v.voice ?? '', (v.style ?? '').trim().toLowerCase()].join(
    '|',
  );
// A missing or unreadable cache is an empty one: rates are a convenience, never a requirement.
const read = (): VoiceRates => {
  try {
    return decodeRates(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return {};
  }
};

/** Remember a measured take: `text` read in `seconds` by this voice setup. */
export function recordRate(
  voice: VoiceRateKey,
  text: string,
  seconds: number,
): number | null {
  const estimate = estimateDuration(text, 150);
  if (!(seconds > 1 && estimate > 0.5)) return null;
  const wpm = (150 * estimate) / seconds;
  const all = read(),
    k = key(voice),
    prev: VoiceRate | undefined = all[k];
  // A running mean over the last few takes, so one odd read cannot swing it far.
  const n = Math.min((prev?.n ?? 0) + 1, 5);
  const mean = prev ? prev.wpm + (wpm - prev.wpm) / n : wpm;
  const rate: VoiceRate = {
    wpm: Math.round(mean * 10) / 10,
    n,
    updated: new Date().toISOString(),
  };
  all[k] = rate;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  return rate.wpm;
}

/** The measured rate for this voice setup, if a real take has been made with it. */
export const measuredRate = (voice: VoiceRateKey): number | null => {
  const rate: VoiceRate | undefined = read()[key(voice)];
  return rate?.wpm ?? null;
};
