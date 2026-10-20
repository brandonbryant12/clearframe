// The run log: what each command measurably spent, phase by phase, appended to
// review/runlog.jsonl. Time between commands is reported as a gap, never as work: the log
// cannot see whether a model was writing, a person was reading, or nothing happened.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import type { JsonValue } from '../domain.mjs';
import { isRecord } from './errors.mjs';
import { reviewPath } from './store.mjs';

/** Facts kept with a run or a phase (frames rendered, the revision made); undefined is left out. */
export type RunFacts = Readonly<Record<string, JsonValue | undefined>>;
/** One timed phase: when it began (ms into the command), how long it took, whether it failed. */
export interface PhaseEntry {
  name: string;
  at: number;
  ms: number;
  failed?: boolean;
  [info: string]: unknown;
}
/** A logged command, as read back: the fields the report reads, and whatever else was logged. */
export interface RunEntry {
  cmd: string;
  startedAt: string;
  endedAt: string;
  ms?: number;
  status?: string;
  phases?: { name: string; ms: number; [info: string]: unknown }[];
  [field: string]: unknown;
}
/** What the report reads from a revision: when it was made and which videos it has. */
export interface RunlogRevision {
  id: string;
  createdAt: string;
  videos?: readonly { profile?: string }[];
}
export interface Milestone {
  revision: string;
  at: string;
  sinceFirstCommandMs: number;
}
export interface Gap {
  before: string;
  at: string;
  ms: number;
}
export interface RunlogReport {
  commands: number;
  firstAt: string | null;
  lastAt: string | null;
  wallMs: number;
  measuredMs: number;
  gapMs: number;
  gaps: Gap[];
  phases: Record<string, { ms: number; count: number }>;
  failed: number;
  milestones: {
    firstReviewableCut: Milestone | null;
    firstRoughCut: Milestone | null;
    firstFinal: Milestone | null;
  };
  runs: RunEntry[];
}

const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;
const RunEntrySchema: Schema.Codec<RunEntry> = Schema.StructWithRest(
  Schema.Struct({
    cmd: Schema.String,
    startedAt: Schema.String,
    endedAt: Schema.String,
    ms: Schema.optionalKey(Schema.Finite),
    status: Schema.optionalKey(Schema.String),
    phases: Schema.optionalKey(
      Schema.Array(
        Schema.StructWithRest(
          Schema.Struct({ name: Schema.String, ms: Schema.Finite }),
          Rest,
        ),
      ).pipe(Schema.mutable),
    ),
  }),
  Rest,
);
const decodeRunEntry = Schema.decodeUnknownSync(RunEntrySchema);

interface Run {
  root: string;
  id: string;
  cmd: string;
  args: string[];
  startedAt: string;
  t0: number;
  phases: PhaseEntry[];
  facts: Record<string, JsonValue | undefined>;
}
let run: Run | null = null;
const ms = (n: number): number => Math.round(n);

export function startRun(
  root: string,
  cmd: string,
  args: readonly unknown[] = [],
): void {
  run = {
    root,
    id: crypto.randomUUID(),
    cmd,
    args: args.map((a) => String(a).slice(0, 120)).slice(0, 40),
    startedAt: new Date().toISOString(),
    t0: performance.now(),
    phases: [],
    facts: {},
  };
}

/** Time `fn` as a named phase of the current command (a no-op outside the CLI). */
export async function phase<T>(
  name: string,
  fn: () => T | PromiseLike<T>,
  info: RunFacts = {},
): Promise<T> {
  const current = run;
  if (!current) return fn();
  const at = performance.now();
  const entry: PhaseEntry = { name, at: ms(at - current.t0), ms: 0, ...info };
  try {
    return await fn();
  } catch (e) {
    entry.failed = true;
    throw e;
  } finally {
    entry.ms = ms(performance.now() - at);
    current.phases.push(entry);
  }
}

/** Facts about the run worth keeping (frames rendered, the revision it made, cached builds). */
export function record(facts: RunFacts): void {
  if (run) Object.assign(run.facts, facts);
}

export function finishRun({ error }: { error?: unknown } = {}): void {
  if (!run) return;
  const r = run;
  run = null;
  if (!fs.existsSync(path.join(r.root, 'storyboard.json'))) return;
  const message = (isRecord(error) ? error.message : undefined) ?? error;
  const line = {
    run: r.id,
    cmd: r.cmd,
    args: r.args,
    startedAt: r.startedAt,
    endedAt: new Date().toISOString(),
    ms: ms(performance.now() - r.t0),
    status: error ? 'failed' : 'ok',
    ...(error ? { error: String(message).split('\n')[0].slice(0, 300) } : {}),
    phases: r.phases,
    ...r.facts,
    host: {
      cpus: os.cpus().length,
      memoryGiB: Math.round(os.totalmem() / 2 ** 30),
      platform: process.platform,
    },
  };
  const file = reviewPath(r.root, 'runlog.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(line) + '\n');
}

/** Every logged command; a line that is not a whole entry (a crash mid-write) is skipped. */
export function readRunlog(root: string): RunEntry[] {
  const file = reviewPath(root, 'runlog.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [decodeRunEntry(JSON.parse(l))];
      } catch {
        return [];
      }
    });
}

/**
 * Observed command time, phase totals, the gaps between commands (inferred, not measured)
 * and wall-clock milestones: the first reviewable cut and the first final.
 */
export function runlogReport(
  entries: readonly RunEntry[],
  revisions: readonly RunlogRevision[] = [],
): RunlogReport {
  const runs = [...entries].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );
  const gaps: Gap[] = [];
  for (let i = 1; i < runs.length; i++) {
    const g = Date.parse(runs[i].startedAt) - Date.parse(runs[i - 1].endedAt);
    if (g > 0) gaps.push({ before: runs[i].cmd, at: runs[i].startedAt, ms: g });
  }
  const phases: Record<string, { ms: number; count: number }> = {};
  for (const r of runs)
    for (const p of r.phases ?? []) {
      phases[p.name] ??= { ms: 0, count: 0 };
      phases[p.name].ms += p.ms;
      phases[p.name].count++;
    }
  const first = runs.length ? Date.parse(runs[0].startedAt) : null;
  const milestone = (
    test: (r: RunlogRevision) => boolean,
  ): Milestone | null => {
    const r = revisions.find(test);
    return r && first != null
      ? {
          revision: r.id,
          at: r.createdAt,
          sinceFirstCommandMs: Date.parse(r.createdAt) - first,
        }
      : null;
  };
  const hasVideo = (r: RunlogRevision, profile?: string): boolean =>
    (r.videos ?? []).some((v) => !profile || v.profile === profile);
  const last = runs.at(-1);
  return {
    commands: runs.length,
    firstAt: runs[0]?.startedAt ?? null,
    lastAt: last?.endedAt ?? null,
    wallMs: last && first != null ? Date.parse(last.endedAt) - first : 0,
    measuredMs: runs.reduce((s, r) => s + (r.ms ?? 0), 0),
    gapMs: gaps.reduce((s, g) => s + g.ms, 0),
    gaps,
    phases,
    failed: runs.filter((r) => r.status === 'failed').length,
    milestones: {
      firstReviewableCut: milestone((r) => hasVideo(r)),
      firstRoughCut: milestone((r) => hasVideo(r, 'rough')),
      firstFinal: milestone((r) => hasVideo(r, 'final')),
    },
    runs,
  };
}
