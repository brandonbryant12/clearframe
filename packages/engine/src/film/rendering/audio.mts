// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { soundDesign } from '../sound.mjs';
import { mix } from '../../engine/lib/audio.mjs';

import { ffmpegBin } from '../../engine/lib/util.mjs';

import { MIXING_SOURCES, finishingSources } from './provenance.mjs';
import type { PreparedContext } from '../preparation/contracts.mjs';
/** The film's full mix, made once per state of its sound: a preview cuts its stretch from it,
 * so the stretch plays at exactly the gain and ducking it has in the whole film. */
export async function fullMix(root: string, ctx: PreparedContext) {
  const cues = soundDesign(ctx.job, ctx.sb.sfx);
  const key = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        beats: ctx.timing.beats.map((b) => [
          b.vo?.src,
          b.vo?.start,
          b.sfx,
          b.start,
          b.end,
          !!b.vo,
        ]),
        music: ctx.timing.music,
        duration: ctx.timing.duration,
        // Only what can be heard, by content: a picture-only edit reuses the mix, and a recording,
        // a bed or a cue file replaced in place (or a built-in cue's recipe) never does.
        audio: [
          ...new Set(
            [
              ...ctx.timing.beats.map((b) => b.vo?.src),
              ctx.timing.music?.src,
            ].filter((src): src is string => typeof src === 'string'),
          ),
        ].map((k) => [k, ctx.manifest.hashes[k] ?? null]),
        sounds: ctx.manifest.sounds ?? {},
        // And by the code that mixes it (cue placement is already in `cues`): a new mixer never
        // reuses a mix the old one made, and a picture-code edit still keeps the sound.
        mixer: Object.fromEntries(
          MIXING_SOURCES.map((rel) => [rel, finishingSources()[rel]]),
        ),
        mix: ctx.sb.mix,
        cues,
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const file = path.join(ctx.dir, `mix-${key}.wav`);
  if (!fs.existsSync(file)) {
    const tmp = path.join(
      ctx.dir,
      `mix-${key}-${crypto.randomUUID().slice(0, 8)}.wav`,
    );
    const track = await mix(root, ctx.timing, tmp, ctx.sb.mix, cues);
    if (!track) return null;
    fs.renameSync(tmp, file);
    // Keep the newest few full mixes; they are rebuilt on demand.
    const old = fs
      .readdirSync(ctx.dir)
      .filter(
        (f) => /^mix-[0-9a-f]{16}\.wav$/.test(f) && f !== path.basename(file),
      )
      .map((f) => path.join(ctx.dir, f))
      .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
    for (const f of old.slice(2)) fs.rmSync(f, { force: true });
  }
  return file;
}

export function loudness(file: string) {
  const r = spawnSync(
    ffmpegBin(),
    [
      '-hide_banner',
      '-nostats',
      '-i',
      file,
      '-map',
      '0:a:0',
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 2 ** 28 },
  );
  // A meter that failed part-way may still have printed numbers: only a clean exit measures.
  if (r.status !== 0) return null;
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = tail.match(/I:\s+(-?[\d.]+) LUFS/),
    p = tail.match(/Peak:\s+(-?[\d.]+) dBFS/);
  return i ? { integrated: Number(i[1]), peak: p ? Number(p[1]) : null } : null;
}
