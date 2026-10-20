import { check } from './process-common.mjs';
import type {
  ProcessSpec,
  ProcessState,
  ProcessWhen,
  ProcessRunTime,
} from './process-contracts.mjs';
export function processSchedule(
  p: ProcessSpec,
  states: ProcessState[],
  when: ProcessWhen,
) {
  // Run times: each run starts on its word, moment or seconds, after the one before it ends.
  const runs: ProcessRunTime[] = [];
  let clock = 0;
  for (const [i, r] of p.runs.entries()) {
    const start = when(r, i === 0 ? 0.6 : clock + 0.6);
    check(
      start >= clock - 1e-6,
      `runs[${i}] starts at ${start.toFixed(2)} s, before runs[${i - 1}] ends (${clock.toFixed(2)} s); cue it later or shorten the run before`,
    );
    runs.push({ start, step: r.dur / r.periods });
    clock = start + r.dur;
  }
  // The time each period's state appears.
  const time = states.map((s) =>
    s.run < 0
      ? 0
      : runs[s.run].start +
        runs[s.run].step *
          (s.period - states.findIndex((x) => x.run === s.run) + 1),
  );
  return { runs, time, clock };
}
