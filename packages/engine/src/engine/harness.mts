// Public local execution boundary. Agent providers remain adapters to ClearFrame's tools.
import * as Effect from 'effect/Effect';
import {
  createJobHarness,
  HarnessError,
  type HarnessOptions,
} from './lib/harness/jobs.mjs';
import { errorMessage } from './lib/harness/contracts.mjs';

export { createJobHarness };

/** Acquire a harness in an Effect scope; interruption/finalization stops its children and store. */
export const jobHarness = (options: HarnessOptions = {}) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => createJobHarness(options),
      catch: (cause) =>
        new HarnessError({
          operation: 'open',
          message: errorMessage(cause),
          cause,
        }),
    }),
    (harness) => Effect.promise(() => harness.stopAll()),
  );

export { harnessEffects, HarnessError } from './lib/harness/jobs.mjs';
export type {
  HarnessOptions,
  JobHarness,
  SoundGrant,
} from './lib/harness/jobs.mjs';
// Request, result and event contracts: schemas and their inferred types (also `clearframe/contracts`).
export {
  decodeJobRequest,
  HarnessRequestError,
  JobEventSchema,
  JobRequestSchema,
  JobViewSchema,
  StartResultSchema,
} from './lib/harness/contracts.mjs';
export type {
  EventOptions,
  HarnessHealth,
  JobEvent,
  JobRequest,
  JobStatus,
  JobKind,
  JobView,
  StartResult,
} from './lib/harness/contracts.mjs';
export { jobStore, JobStoreError } from './lib/harness/job-store.mjs';
