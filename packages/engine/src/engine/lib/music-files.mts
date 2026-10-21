// One source of truth for the generated bed, including legacy projects without a file field.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as Schema from 'effect/Schema';
import { readJSON } from './util.mjs';

/** `assets/music/bed.json`: how the bed was made. Generators add their spec's own fields. */
export interface MusicBedMeta {
  file?: string;
  hash?: string;
  provider?: string;
  model?: string;
  prompt?: string;
  notes?: string;
  seconds?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export const MusicBedMetaSchema: Schema.Codec<MusicBedMeta> =
  Schema.StructWithRest(
    Schema.Struct({
      file: Schema.optionalKey(Schema.String),
      hash: Schema.optionalKey(Schema.String),
      provider: Schema.optionalKey(Schema.String),
      model: Schema.optionalKey(Schema.String),
      prompt: Schema.optionalKey(Schema.String),
      notes: Schema.optionalKey(Schema.String),
      seconds: Schema.optionalKey(Schema.Finite),
      createdAt: Schema.optionalKey(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  );
const decodeMeta = Schema.decodeUnknownSync(MusicBedMetaSchema);

/** The bed's metadata, or null when the project has none (or it is not JSON). */
export function readMusicBedMeta(root: string): MusicBedMeta | null {
  const raw: unknown = readJSON(path.join(root, 'assets/music/bed.json'), null);
  return raw === null ? null : decodeMeta(raw);
}

const extensions: readonly string[] = ['wav', 'mp3', 'ogg'];
export function findMusicBed(
  root: string,
  meta: MusicBedMeta | null = readMusicBedMeta(root),
): string | null {
  const candidates = meta?.file
    ? [meta.file]
    : extensions.map((ext) => `assets/music/bed.${ext}`);
  return (
    candidates.find((file) => {
      try {
        const st = fs.statSync(path.join(root, file));
        return st.isFile() && st.size > 0;
      } catch {
        return false;
      }
    }) ?? null
  );
}

/** Stage complete bytes before replacing a bed; delete alternate formats only after success. */
export function writeMusicBed(
  root: string,
  data: Uint8Array,
  ext: string,
  meta: MusicBedMeta,
): string {
  if (!extensions.includes(ext) || !data.length)
    throw new Error('Cannot save an empty or unsupported music bed');
  const file = `assets/music/bed.${ext}`;
  const dest = path.join(root, file),
    metaFile = path.join(root, 'assets/music/bed.json');
  const token = randomUUID(),
    tmp = `${dest}.${token}.tmp`,
    metaTmp = `${metaFile}.${token}.tmp`;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(tmp, data);
    fs.writeFileSync(
      metaTmp,
      JSON.stringify({ ...meta, file }, null, 2) + '\n',
    );
    fs.renameSync(tmp, dest);
    fs.renameSync(metaTmp, metaFile);
    for (const other of extensions)
      if (other !== ext)
        fs.rmSync(path.join(root, `assets/music/bed.${other}`), {
          force: true,
        });
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(metaTmp, { force: true });
  }
  return file;
}
