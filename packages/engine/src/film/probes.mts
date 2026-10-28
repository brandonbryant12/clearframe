import { spawnSync } from 'node:child_process';
import * as Schema from 'effect/Schema';

const numberText = Schema.Union([Schema.String, Schema.Finite]);
const streamSchema = Schema.StructWithRest(
  Schema.Struct({
    codec_type: Schema.optionalKey(Schema.String),
    width: Schema.optionalKey(Schema.Finite),
    height: Schema.optionalKey(Schema.Finite),
    avg_frame_rate: Schema.optionalKey(Schema.String),
    sample_aspect_ratio: Schema.optionalKey(Schema.String),
    nb_read_frames: Schema.optionalKey(numberText),
    color_space: Schema.optionalKey(Schema.String),
    color_transfer: Schema.optionalKey(Schema.String),
    color_primaries: Schema.optionalKey(Schema.String),
    color_range: Schema.optionalKey(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const probeSchema = Schema.Struct({
  streams: Schema.optionalKey(Schema.Array(streamSchema).pipe(Schema.mutable)),
  format: Schema.optionalKey(
    Schema.Struct({
      duration: Schema.optionalKey(numberText),
    }),
  ),
});
export type ProbeStream = typeof streamSchema.Type;
export const decodeProbe = Schema.decodeUnknownSync(probeSchema);

/** Probe failures are failures, even when the process prints a partial JSON result. */
export function probeFile(
  file: string,
  entries: string[],
): typeof probeSchema.Type {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-threads', '2', ...entries, '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || `Cannot probe ${file}`);
  return decodeProbe(JSON.parse(result.stdout));
}

export function probeDuration(file: string): number {
  const duration = Number(
    probeFile(file, ['-show_entries', 'format=duration']).format?.duration,
  );
  if (!Number.isFinite(duration))
    throw new Error(`Cannot determine duration of ${file}`);
  return duration;
}

/** A sample aspect ratio ("4:3") as a number; unknown ("0:1", "N/A", absent) reads as square. */
export function pixelAspect(sar: string | undefined): number {
  const [num, den] = (sar ?? '').split(':').map(Number);
  return num > 0 && den > 0 ? num / den : 1;
}

/**
 * Footage the native decoder can draw, and its duration. The decoder draws a clip's stored
 * pixels, so footage with non-square pixels (anamorphic DV/HDV, some phone and broadcast
 * exports) would appear squeezed or stretched: it is refused with the conversion that fixes it,
 * never drawn at the wrong shape.
 */
export function probeFootage(file: string, where: string, name = file): number {
  const probe = probeFile(file, [
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,sample_aspect_ratio:format=duration',
  ]);
  const stream = probe.streams?.[0];
  const aspect = pixelAspect(stream?.sample_aspect_ratio);
  if (Math.abs(aspect - 1) > 1e-6) {
    const { width = 0, height = 0 } = stream ?? {};
    throw new Error(
      `${where}: footage ${name} has non-square pixels (sample aspect ratio ${stream?.sample_aspect_ratio}: ${width}×${height} stored, ${Math.round(width * aspect)}×${height} shown), so it would be drawn ${aspect > 1 ? 'squeezed' : 'stretched'}. Convert it once and use the copy: ffmpeg -i "${name}" -vf "scale=trunc(iw*sar/2)*2:ih,setsar=1" -c:a copy square.mp4`,
    );
  }
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration))
    throw new Error(`Cannot determine duration of ${file}`);
  return duration;
}
