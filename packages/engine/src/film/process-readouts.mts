import { check, fmt } from './process-common.mjs';
import type {
  ProcessDrawing,
  ProcessState,
  Scheduled,
  Stepped,
  Capacity,
} from './process-contracts.mjs';
function stateForRun(states: ProcessState[], run: number): ProcessState {
  const state = states.find((s) => s.run === run);
  check(state, `missing state for run ${run}`);
  return state;
}
export function processReadouts({
  out,
  timed,
  time,
  p,
  states,
  runs,
}: ProcessDrawing) {
  const scheduled: Scheduled = (id, values, times, place, style = {}) => {
    let k = 0;
    while (k < values.length) {
      let j = k;
      while (j + 1 < values.length && values[j + 1] === values[k]) j++;
      const enter = k === 0 ? 0 : times[k],
        leave = j + 1 < values.length ? times[j + 1] : null;
      out.push({
        id: timed(`${id}-${k}`),
        type: 'text',
        text: values[k],
        ...place,
        ...style,
        at: enter,
        enter: 'none',
        ...(leave != null ? { exit: 'none', exitAt: leave } : {}),
      });
      k = j + 1;
    }
  };
  // Queues, the clock and the done count are period-end states; a capacity is an assumption that
  // changes when its run starts (the intervention), before that run's first period has elapsed.
  const stepped: Stepped = (id, values, place, style) =>
    scheduled(id, values, time, place, style);
  const capacity: Capacity = (i, place, style) =>
    scheduled(
      `pr-${p.id}-${p.stages[i].id}-cap`,
      [
        states[0].caps[i],
        ...p.runs.map((r, ri) => stateForRun(states, ri).caps[i]),
      ].map((c) => `${fmt(c)} a ${p.period}`),
      [0, ...runs.map((r) => r.start)],
      place,
      style,
    );
  return { stepped, capacity };
}
