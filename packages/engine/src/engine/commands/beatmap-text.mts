import type { analyseTrack } from '../lib/beatmap.mjs';
export function beatmapText(r: ReturnType<typeof analyseTrack>) {
  const t = r.tempo;
  return [
    `${r.seconds}s of music`,
    t
      ? `tempo ${t.bpm} BPM (or ${t.alternatives.join(' / ')}: listen), first beat at ${t.phase}s`
      : 'no steady tempo',
    r.drop
      ? `drop at ${r.drop.t}s in the song (bass +${r.drop.jump} dB)`
      : 'no drop: the bass never jumps and stays up',
  ].join(' · ');
}
