// How fast each voice actually reads. After a real take, the words-per-minute that makes
// the draft estimate match the measured take is remembered per model, voice and style, so
// drafts of the next film are timed like the final instead of at a generic 150 wpm.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_DIR } from './util.mjs';
import { estimateDuration } from './timing.mjs';

const FILE =
  process.env.CF_VOICE_RATES ?? path.join(REPO_DIR, 'node_modules', '.cache', 'clearframe', 'voice-rates.json');
const key = v => [v.model ?? '', v.voice ?? '', (v.style ?? '').trim().toLowerCase()].join('|');
const read = () => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
};

/** Remember a measured take: `text` read in `seconds` by this voice setup. */
export function recordRate(voice, text, seconds) {
  const estimate = estimateDuration(text, 150);
  if (!(seconds > 1 && estimate > 0.5)) return null;
  const wpm = (150 * estimate) / seconds;
  const all = read(),
    k = key(voice),
    prev = all[k];
  // A running mean over the last few takes, so one odd read cannot swing it far.
  const n = Math.min((prev?.n ?? 0) + 1, 5);
  const mean = prev ? prev.wpm + (wpm - prev.wpm) / n : wpm;
  all[k] = { wpm: Math.round(mean * 10) / 10, n, updated: new Date().toISOString() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
  return all[k].wpm;
}

/** The measured rate for this voice setup, if a real take has been made with it. */
export const measuredRate = voice => read()[key(voice)]?.wpm ?? null;
