import * as Schema from 'effect/Schema';
import type { JsonValue } from '../../domain.mjs';
import { JsonValueSchema } from '../../schemas.mjs';
import type { critique } from '../critique.mjs';
import type { qaProject } from '../qa.mjs';
import type { CheckResult } from '../../../film/preparation/contracts.mjs';
import type { RenderReport } from '../../../film/rendering/contracts.mjs';
export interface PipelineOptions {
  draft?: boolean;
  scale?: number;
  noRender?: boolean;
}
export interface PipelineStage {
  name: string;
  status: 'running' | 'passed' | 'failed';
  error?: string;
  seconds?: number;
}
export interface PipelineInputs {
  inputId: string;
  hashes: Record<string, string>;
  [key: string]: JsonValue;
}
export const PipelineInputsSchema: Schema.Codec<PipelineInputs> =
  Schema.StructWithRest(
    Schema.Struct({
      inputId: Schema.String,
      hashes: Schema.Record(Schema.String, Schema.String),
    }),
    [Schema.Record(Schema.String, JsonValueSchema)],
  );
export const decodePipelineInputs =
  Schema.decodeUnknownSync(PipelineInputsSchema);
export const decodeSheetIdentity = Schema.decodeUnknownSync(
  Schema.Struct({ inputId: Schema.String }),
);
export interface PipelineReport {
  version: 1;
  id: string;
  dir: string;
  project: string;
  status: 'running' | 'checked-no-render' | 'ready-for-review' | 'failed';
  draft: boolean;
  scale: number;
  startedAt: string;
  finishedAt?: string;
  seconds?: number;
  error?: string;
  stages: PipelineStage[];
  artifacts: Record<string, string>;
  reviewQueue: string[];
  critique?: ReturnType<typeof critique>;
  check?: CheckResult;
  inputs?: PipelineInputs;
  render?: RenderReport;
  qa?: Pick<
    Awaited<ReturnType<typeof qaProject>>,
    'summary' | 'findings' | 'evidence'
  >;
}
