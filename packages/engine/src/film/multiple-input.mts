import * as Schema from 'effect/Schema';
import type { RankInput } from './multiple-data.mjs';
const rankInput: Schema.Codec<RankInput> = Schema.StructWithRest(
  Schema.Struct({
    plot: Schema.Unknown,
    rankAt: Schema.String,
    direction: Schema.String,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const decodeRankInput = Schema.decodeUnknownSync(rankInput);
