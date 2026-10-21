// Free draft takes spoken by the macOS voice: one continuous call per take, or one per part when
// a cast needs several voices (the parts are then joined, so their bounds are known exactly).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanVoice, forOsVoice } from './audio-voice.mjs';
import { ffmpeg } from './util.mjs';
import { castVoices } from './takes-plan.mjs';
import type { TakeSpec, TakeStoryboard } from './takes-plan.mjs';
import type { PartBounds } from './takes-words.mjs';

/** Silence after each part of a joined cast take, in seconds. */
const PART_GAP = 0.35;

function say(
  sb: Pick<TakeStoryboard, 'voice'>,
  text: string,
  voice: string | undefined,
  file: string,
): void {
  const r = spawnSync('say', [
    ...(voice ? ['-v', voice] : []),
    '-r',
    String(Math.round(sb.voice.wpm * 0.9)),
    '-o',
    file,
    text,
  ]);
  if (r.status !== 0) throw new Error(`say failed: ${r.stderr}`);
}

/** Script text as the OS voice reads it: respelled, tags as silences, backchannels dropped. */
const forSay = (sb: Pick<TakeStoryboard, 'voice'>, t: string): string =>
  forOsVoice(t, sb.voice.pronounce)
    .replace(/<([^>]+)>/g, ' [[slnc 350]] ')
    .replace(/\|[^|]*\|/g, ' ');

/** Duration of a media file from ffprobe, in seconds. */
function probeDuration(file: string): number {
  return Number(
    spawnSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'csv=p=0',
        file,
      ],
      { encoding: 'utf8' },
    ).stdout,
  );
}

/** Each part of a cast take in its speaker's voice, joined with a short silence after each. */
async function castTake(
  sb: Pick<TakeStoryboard, 'voice'>,
  spec: TakeSpec & { cast: NonNullable<TakeSpec['cast']> },
  out: string,
  tmp: string,
): Promise<PartBounds> {
  const voices = castVoices(sb, spec.cast);
  const files = spec.parts.map((p, i) => {
    const f = path.join(tmp, `p${i}.aiff`);
    say(
      sb,
      forSay(sb, p.text),
      p.speaker === undefined ? undefined : voices[p.speaker],
      f,
    );
    return f;
  });
  const inputs = files.flatMap((f) => ['-i', f]);
  const filter =
    files
      .map((_, i) => `[${i}:a]aresample=24000,apad=pad_dur=${PART_GAP}[a${i}]`)
      .join(';') +
    ';' +
    files.map((_, i) => `[a${i}]`).join('') +
    `concat=n=${files.length}:v=0:a=1[o]`;
  await ffmpeg([
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[o]',
    '-ac',
    '1',
    '-ar',
    '24000',
    '-c:a',
    'pcm_s16le',
    out,
  ]);
  // Parts were joined here, so the boundaries are known exactly.
  const bounds: PartBounds = [];
  let t = 0;
  for (const f of files) {
    const d = probeDuration(f);
    bounds.push([t, t + d]);
    t += d + PART_GAP;
  }
  return bounds;
}

/** Draft takes with the OS voice: one continuous call per take (per part when a cast needs several voices). */
export async function draftTake(
  sb: Pick<TakeStoryboard, 'voice'>,
  spec: TakeSpec,
  out: string,
): Promise<PartBounds | null> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-take-'));
  try {
    if (process.platform !== 'darwin')
      throw new Error(
        'Draft takes need macOS say; record per beat instead (voice.takes: "beat").',
      );
    const { cast } = spec;
    if (cast) return await castTake(sb, { ...spec, cast }, out, tmp);
    const f = path.join(tmp, 'take.aiff');
    say(
      sb,
      spec.parts.map((p) => forSay(sb, p.text)).join(' [[slnc 420]] '),
      sb.voice.draftVoice,
      f,
    );
    await cleanVoice(f, out);
    return null;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
