// A narration take's metadata (`assets/vo/<beat>.json`) as alignment reads it. The file is
// rewritten with every field it already had, so the raw record travels with the decoded view.
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { isRecord } from './errors.mjs';
import { readJSON } from './util.mjs';

/** The fields alignment reads; `words` stays raw until it is validated against the script. */
export interface TakeNarration {
  textHash?: string;
  provider?: string | null;
  duration?: number | null;
  words?: unknown;
  alignment?: { kind?: string; audioHash?: string | null };
}
const TakeNarrationSchema: Schema.Codec<TakeNarration> = Schema.Struct({
  textHash: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(Schema.NullOr(Schema.String)),
  duration: Schema.optionalKey(Schema.NullOr(Schema.Finite)),
  words: Schema.optionalKey(Schema.Unknown),
  alignment: Schema.optionalKey(
    Schema.Struct({
      kind: Schema.optionalKey(Schema.String),
      audioHash: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
});
const decodeTakeNarration = Schema.decodeUnknownOption(TakeNarrationSchema);

export interface NarrationFile {
  raw: Record<string, unknown>;
  meta: TakeNarration;
}

/** The take's metadata, or null when there is none (or it is not a metadata object). */
export function readNarration(file: string): NarrationFile | null {
  const raw = readJSON(file, null);
  if (!isRecord(raw)) return null;
  return Option.getOrNull(
    Option.map(decodeTakeNarration(raw), (meta) => ({ raw, meta })),
  );
}

/**
 * The audio length words are checked against. A missing length leaves the end unchecked and a
 * null one checks against zero, as the arithmetic on the original values did.
 */
export const audioBound = (duration: number | null | undefined): number =>
  duration === undefined ? Infinity : (duration ?? 0);
