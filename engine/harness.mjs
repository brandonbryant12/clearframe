// Public local execution boundary. Agent providers remain adapters to ClearFrame's tools.
import * as Effect from 'effect/Effect';
import { createJobHarness } from './lib/harness/jobs.mjs';

export { createJobHarness };

/** Acquire a harness in an Effect scope; interruption/finalization stops its children and store. */
export const jobHarness = options => Effect.acquireRelease(
  Effect.try({ try: () => createJobHarness(options), catch: error => error }),
  harness => Effect.promise(() => harness.stopAll()),
);
