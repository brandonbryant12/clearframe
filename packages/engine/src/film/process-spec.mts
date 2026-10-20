import { check, own, words, count, ID } from './process-common.mjs';
import { decodeProcess } from './process-schema.mjs';
import type { ProcessSpec } from './process-contracts.mjs';
/** Validate a process. Capacities and arrivals are whole items per period. */
export function processSpec(input: unknown): ProcessSpec {
  own(
    input,
    [
      'id',
      'title',
      'unit',
      'period',
      'arrivals',
      'stages',
      'start',
      'runs',
      'token',
      'done',
      'source',
      'asOf',
    ],
    'process',
  );
  const decoded = decodeProcess(input);
  const p: ProcessSpec = {
    ...decoded,
    id: decoded.id ?? 'process',
    unit: decoded.unit ?? 'items',
    period: decoded.period ?? 'day',
    token: decoded.token ?? 1,
    done: decoded.done ?? 'Done',
    source: decoded.source ?? 'Illustrative model of stated rates',
  };
  check(
    typeof p.id === 'string' && ID.test(p.id),
    'id is a short lowercase name',
  );
  words(p.title, 'title', 70);
  words(p.unit, 'unit (what flows, plural, e.g. "requests")', 24);
  words(p.period, 'period (e.g. "day")', 12);
  words(p.done, 'done (the label for finished work)', 20);
  // The figures are a model of stated assumptions: the source line says so unless it names a real source.
  p.source = words(
    p.source ?? 'Illustrative model of stated rates',
    'source',
    110,
  );
  check(
    count(p.arrivals) && p.arrivals > 0,
    `arrivals must be a whole number of ${p.unit} per ${p.period} (more than 0)`,
  );
  check(
    Number.isInteger(p.token) && p.token >= 1 && p.token <= 1000,
    'token is how many items one token stands for (a whole number, 1 by default)',
  );
  check(
    Array.isArray(p.stages) && p.stages.length >= 2 && p.stages.length <= 5,
    'stages needs 2–5 stages in order (a serial flow: every item passes through each stage once; branching flows are not modelled)',
  );
  const ids = new Set<string>();
  p.stages.forEach((s, i) => {
    own(s, ['id', 'label', 'capacity'], `stages[${i}]`);
    check(
      typeof s.id === 'string' && ID.test(s.id) && !ids.has(s.id),
      `stages[${i}].id is a unique short lowercase name`,
    );
    ids.add(s.id);
    words(s.label, `stages[${i}].label`, 24);
    check(
      count(s.capacity) && s.capacity > 0,
      `stages[${i}].capacity must be a whole number of ${p.unit} per ${p.period} (more than 0)`,
    );
  });
  if (p.start != null) {
    own(p.start, [...ids], 'start');
    for (const [k, v] of Object.entries(p.start))
      check(
        count(v),
        `start.${k} is the ${p.unit} already waiting before ${k} (a whole number)`,
      );
  }
  check(
    Array.isArray(p.runs) && p.runs.length >= 1 && p.runs.length <= 4,
    'runs needs 1–4 stretches of model time: {periods, say|cue|at, dur, set?}',
  );
  p.runs.forEach((r, i) => {
    own(
      r,
      ['periods', 'say', 'cue', 'at', 'after', 'dur', 'set'],
      `runs[${i}]`,
    );
    check(
      Number.isInteger(r.periods) && r.periods >= 1 && r.periods <= 30,
      `runs[${i}].periods is 1–30 ${p.period}s of model time`,
    );
    check(
      typeof r.dur === 'number' && r.dur >= 0.4 * r.periods && r.dur <= 20,
      `runs[${i}].dur is the seconds those ${r.periods} ${p.period}s take on screen (at least 0.4 s each, so every count can be read)`,
    );
    check(
      (['say', 'cue', 'at'] as const).filter((k) => r[k] != null).length <= 1,
      `runs[${i}] takes one of say, cue or at`,
    );
    if (r.set != null) {
      own(r.set, [...ids], `runs[${i}].set`);
      for (const [k, v] of Object.entries(r.set))
        check(
          count(v) && v > 0,
          `runs[${i}].set.${k} is the new capacity (a whole number more than 0)`,
        );
    }
  });
  check(
    p.runs[0].set == null,
    'the first run uses the stated capacities; change one in a later run',
  );
  check(
    p.runs.reduce((a, r) => a + r.periods, 0) <= 40,
    'at most 40 periods of model time in one beat',
  );
  return p;
}
