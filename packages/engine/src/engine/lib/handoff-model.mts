import * as Schema from 'effect/Schema';
export interface PackageFile {
  path: string;
  sha256: string;
}
const PackageFileSchema = Schema.Struct({
  path: Schema.String,
  sha256: Schema.String,
});
export const HandoffManifestSchema = Schema.StructWithRest(
  Schema.Struct({
    version: Schema.Number,
    revision: Schema.String,
    inputId: Schema.optionalKey(Schema.String),
    packageFiles: Schema.Array(PackageFileSchema),
    delivery: Schema.NullOr(
      Schema.Struct({
        path: Schema.String,
        receipt: Schema.String,
        sha256: Schema.String,
        profile: Schema.optionalKey(Schema.String),
      }),
    ),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export type HandoffManifest = typeof HandoffManifestSchema.Type;
