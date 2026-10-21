import type { SoundCue, WeightedCue } from './sound-contracts.mjs';

export function selectSounds(cues: WeightedCue[]): SoundCue[] {
  // Keep the heavier of two cues closer than 0.16 s, so hits never smear together.
  cues.sort((a, b) => a.t - b.t);
  const kept: (SoundCue & { weight: number })[] = [];
  for (const c of cues) {
    const last = kept.at(-1);
    if (last && c.t - last.t < 0.16) {
      if (c.weight > last.weight) kept[kept.length - 1] = c;
      continue;
    }
    kept.push(c);
  }
  return kept.map(({ weight: _weight, ...c }) => c);
}
