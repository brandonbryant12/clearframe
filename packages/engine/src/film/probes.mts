import { spawnSync } from 'node:child_process';
import * as Schema from 'effect/Schema';

const numberText = Schema.Union([Schema.String, Schema.Finite]);
const streamSchema = Schema.StructWithRest(
  Schema.Struct({
    codec_type: Schema.optionalKey(Schema.String),
    width: Schema.optionalKey(Schema.Finite),
    height: Schema.optionalKey(Schema.Finite),
    avg_frame_rate: Schema.optionalKey(Schema.String),
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
