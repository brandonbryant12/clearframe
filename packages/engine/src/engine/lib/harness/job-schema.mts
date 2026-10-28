import * as Schema from 'effect/Schema';
import {
  jobRecordFields,
  SoundApprovalSchema,
  type JobRecord,
} from './contracts.mjs';

const extension = [Schema.Record(Schema.String, Schema.Unknown)] as const;

/** Persisted job fields are decoded in full; extension data from older ledgers is retained. */
export const JobSchema: Schema.Codec<JobRecord> = Schema.StructWithRest(
  Schema.Struct({
    ...jobRecordFields,
    approval: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          ...SoundApprovalSchema.fields,
          basis: Schema.StructWithRest(
            Schema.Struct({ specs: Schema.Unknown }),
            extension,
          ),
        }),
        extension,
      ),
    ),
  }),
  extension,
);
