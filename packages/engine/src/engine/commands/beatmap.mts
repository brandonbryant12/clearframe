import path from 'node:path';

import type { CommandContext } from './options.mjs';
import { beatmapText } from './beatmap-text.mjs';

export async function beatmapCommand({ positionals, o }: CommandContext) {
  const { analyseTrack } = await import('../lib/beatmap.mjs');
  const r = analyseTrack(path.resolve(positionals[0]));
  if (o.json) return console.log(JSON.stringify(r, null, 2));
  return console.log(beatmapText(r));
}

export async function beatmap2Command({ o, dir }: CommandContext) {
  const { analyseTrack, cutsOnGrid } = await import('../lib/beatmap.mjs');
  const { computeTiming } = await import('../lib/timing.mjs');
  const timing = computeTiming(dir);
  if (!timing.music?.src)
    throw new Error(
      'No music bed yet: run music DIR --draft, or set music.file.',
    );
  const r = analyseTrack(path.join(dir, timing.music.src));
  const grid = r.tempo
    ? cutsOnGrid(timing.beats, r.tempo, timing.music.offset)
    : [];
  if (o.json)
    return console.log(
      JSON.stringify({ ...r, music: timing.music, cuts: grid }, null, 2),
    );
  const off = timing.music.offset;
  const lines = [beatmapText(r)];
  if (r.drop)
    lines.push(
      timing.music.drop
        ? `drop plays at ${timing.music.drop.film}s (beat ${timing.music.drop.beat})`
        : `drop plays at ${Math.round((r.drop.t - off) * 100) / 100}s of the film; land it on the key picture with "music": {"drop": {"beat": "ID"}}`,
    );
  if (grid.length)
    lines.push(
      `cuts against the beat (ms after the nearest beat; within ±60 reads as on the beat):`,
      ...grid.map(
        (c) =>
          `  ${String(c.t).padStart(6)}s ${c.id.padEnd(18)} ${c.ms > 0 ? '+' : ''}${c.ms}${Math.abs(c.ms) <= 60 ? '  ✓' : ''}`,
      ),
    );
  return console.log(lines.join('\n'));
}
