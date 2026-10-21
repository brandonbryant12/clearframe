// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.

// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import { ffmpeg } from '../../engine/lib/util.mjs';

import { sha256File } from '../../engine/lib/store.mjs';

import { probeFile } from '../probes.mjs';
import { validateVideo } from './validation.mjs';
import type { CutOptions } from './contracts.mjs';

/**
 * Frames [a, b) of an existing film (a revision's stored video), re-encoded for side-by-side
 * review with its own audio samples. The frames are what that person watched.
 */
export async function cutPassage(
  video: string,
  { fps, a, b, out }: CutOptions,
) {
  const streams = probeFile(video, ['-show_streams']).streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  if (!v || typeof v.width !== 'number' || typeof v.height !== 'number')
    throw new Error(`Cannot read video dimensions: ${video}`);
  const hasAudio = streams.some((s) => s.codec_type === 'audio');
  const rate = 48000;
  await ffmpeg([
    '-y',
    '-i',
    video,
    '-vf',
    `select=between(n\\,${a}\\,${b - 1}),setpts=N/(${fps}*TB)`,
    '-r',
    String(fps),
    ...(hasAudio
      ? [
          '-af',
          `aresample=${rate},atrim=start_sample=${(a * rate) / fps}:end_sample=${(b * rate) / fps},asetpts=PTS-STARTPTS`,
        ]
      : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : []),
    '-movflags',
    '+faststart',
    out,
  ]);
  validateVideo(out, { width: v.width, height: v.height, fps, frames: b - a });
  return { output: out, frames: b - a, outputSha256: sha256File(out) };
}
