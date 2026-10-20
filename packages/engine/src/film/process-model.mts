import { check } from './process-common.mjs';
import type { ProcessSpec, ProcessState } from './process-contracts.mjs';
/**
 * The model, period by period. Each period: `arrivals` join the first queue; then, in order, each
 * stage takes up to its capacity from its queue and hands it to the next stage's queue (a hand-off
 * within the period), and the last stage's output is done. Returns every period's state; throws if
 * an item is ever created or lost (sum of queues + done must equal everything that arrived).
 */
export function processModel(p: ProcessSpec): ProcessState[] {
  const n = p.stages.length;
  let queues = p.stages.map((s) => p.start?.[s.id] ?? 0);
  const startQueued = queues.reduce((a, v) => a + v, 0);
  let caps = p.stages.map((s) => s.capacity),
    done = 0,
    arrived = 0,
    period = 0;
  const states: ProcessState[] = [
    {
      period,
      queues: [...queues],
      done,
      caps: [...caps],
      moved: Array.from({ length: n }, () => 0),
      run: -1,
    },
  ];
  p.runs.forEach((r, ri) => {
    if (r.set) caps = p.stages.map((s, i) => r.set?.[s.id] ?? caps[i]);
    for (let k = 0; k < r.periods; k++) {
      period++;
      queues[0] += p.arrivals;
      arrived += p.arrivals;
      const moved = [];
      for (let i = 0; i < n; i++) {
        const take = Math.min(queues[i], caps[i]);
        queues[i] -= take;
        moved.push(take);
        if (i + 1 < n) queues[i + 1] += take;
        else done += take;
      }
      const total = queues.reduce((a, v) => a + v, 0) + done;
      check(
        total === arrived + startQueued,
        `model lost or created items in ${p.period} ${period}`,
      );
      states.push({
        period,
        queues: [...queues],
        done,
        caps: [...caps],
        moved,
        run: ri,
      });
    }
  });
  return states;
}
