// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.

// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import { probeFile } from '../probes.mjs';
import type { ExpectedVideo } from './contracts.mjs';

export function validateVideo(
  file: string,
  { width, height, fps, frames }: ExpectedVideo,
) {
  const streams =
    probeFile(file, ['-count_frames', '-show_streams']).streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video');
  const [n, d] = (v?.avg_frame_rate ?? '0/1').split('/').map(Number);
  if (
    !v ||
    v.width !== width ||
    v.height !== height ||
    Math.abs(n / d - fps) > 0.001 ||
    Number(v.nb_read_frames) !== frames
  )
    throw new Error(
      'Native output dimensions, frame rate or decoded frame count differ from the storyboard.',
    );
  return {
    video: v,
    audio: streams.find((s) => s.codec_type === 'audio') ?? null,
  };
}
