// Public local execution boundary. Agent providers remain adapters to ClearFrame's tools.
import * as Effect from 'effect/Effect';
import { createJobHarness, type HarnessOptions } from './lib/harness/jobs.mjs';

export { createJobHarness };

/** Acquire a harness in an Effect scope; interruption/finalization stops its children and store. */
export const jobHarness = (options: HarnessOptions = {}) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => createJobHarness(options),
      catch: (error) => error,
    }),
    (harness) => Effect.promise(() => harness.stopAll()),
  );

export { harnessEffects, HarnessError } from './lib/harness/jobs.mjs';
export type {
  HarnessOptions,
  JobHarness,
  SoundGrant,
} from './lib/harness/jobs.mjs';
export type {
  JobRequest,
  JobStatus,
  JobKind,
  JobView,
} from './lib/harness/contracts.mjs';
export { jobStore, JobStoreError } from './lib/harness/job-store.mjs';
