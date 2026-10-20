// What generation commands share: their options, the cache records they compare against, and
// the two refusals made before any paid call (the budget, and a person's approval of the sound).
import fs from 'node:fs';
import path from 'node:path';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import type { Beat, Format } from '../domain.mjs';
import { isRecord } from './errors.mjs';
import { readJSON } from './util.mjs';

/** Options of the generation commands (`voice`, `music`, `images`, `clips`), as the CLI passes them. */
export interface GenerateOptions {
  draft?: boolean | undefined;
  force?: boolean | undefined;
  only?: readonly string[] | null | undefined;
  budget?: number | null | undefined;
  'dry-run'?: boolean | undefined;
}

export type SoundKind = 'voice' | 'music';

export const money = (n: number): string => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;

export function guardBudget(
  total: number,
  budget: number | null | undefined,
): void {
  if (budget != null && total > budget) {
    throw new Error(
      `Estimated spend ${money(total)} exceeds the budget ${money(budget)}. Raise it with --budget or storyboard.budget.`,
    );
  }
}

/**
 * A person's approval in the studio is bound to the exact provider requests (content hashes) a
 * paid run will send; the run re-derives them after any queue or gate wait, before any provider
 * call, and refuses if they differ (CLEARFRAME_APPROVED_SOUND).
 */
export function assertApproved(
  kind: SoundKind,
  specs: readonly string[],
): void {
  const raw = process.env.CLEARFRAME_APPROVED_SOUND;
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'The sound approval passed to this run is unreadable; nothing was generated.',
    );
  }
  const approval = isRecord(parsed) ? parsed : undefined;
  if (
    approval?.kind !== kind ||
    JSON.stringify(approval.specs) !== JSON.stringify(specs)
  )
    throw new Error(
      `The ${kind === 'voice' ? 'narration' : 'music'} changed after it was approved (words, voice, style, direction or model), so nothing was generated or charged. Review and approve it again.`,
    );
}

export const nonempty = (file: string): boolean => {
  try {
    return fs.statSync(file).size > 0;
  } catch {
    return false;
  }
};

/** `assets/img|clips/<id>.json`: what a generated asset was made from, and a clip's measured length. */
export interface AssetRecord {
  hash?: string;
  seconds?: number;
}
const AssetRecordSchema: Schema.Codec<AssetRecord> = Schema.Struct({
  hash: Schema.optionalKey(Schema.String),
  seconds: Schema.optionalKey(Schema.Finite),
});
const decodeAssetRecord = Schema.decodeUnknownOption(AssetRecordSchema);

/** A generated asset's record, or null when there is none (or it cannot be read as one). */
export const assetMeta = (dir: string, id: string): AssetRecord | null =>
  Option.getOrNull(
    decodeAssetRecord(readJSON(path.join(dir, `${id}.json`), null)),
  );

/** `assets/vo/<beat>.json` as generation reads it: which request made the line, from which words. */
export interface LineRecord {
  hash?: string;
  textHash?: string;
  provider?: string | null;
  take?: { hash?: string };
}
const LineRecordSchema: Schema.Codec<LineRecord> = Schema.Struct({
  hash: Schema.optionalKey(Schema.String),
  textHash: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(Schema.NullOr(Schema.String)),
  take: Schema.optionalKey(
    Schema.Struct({ hash: Schema.optionalKey(Schema.String) }),
  ),
});
const decodeLineRecord = Schema.decodeUnknownOption(LineRecordSchema);
export const lineMeta = (file: string): LineRecord | null =>
  Option.getOrNull(decodeLineRecord(readJSON(file, null)));

/** A beat with narration. */
export type NarratedBeat = Beat & { vo: string };
export const narrated = (b: Beat): b is NarratedBeat => Boolean(b.vo);

/** The frame's aspect, as image and video models name it. */
export function frameAspect({
  width,
  height,
}: Format): '16:9' | '9:16' | '1:1' {
  if (width > height) return '16:9';
  return width < height ? '9:16' : '1:1';
}
