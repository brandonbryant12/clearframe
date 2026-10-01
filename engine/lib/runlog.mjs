// The run log: what each command measurably spent, phase by phase, appended to
// review/runlog.jsonl. Time between commands is reported as a gap, never as work: the log
// cannot see whether a model was writing, a person was reading, or nothing happened.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { reviewPath } from './store.mjs';

let run = null;
const ms = n => Math.round(n);

export function startRun(root, cmd, args = []) {
  run = {
    root,
    id: crypto.randomUUID(),
    cmd,
    args: args.map(a => String(a).slice(0, 120)).slice(0, 40),
    startedAt: new Date().toISOString(),
    t0: performance.now(),
    phases: [],
    facts: {},
  };
}

/** Time `fn` as a named phase of the current command (a no-op outside the CLI). */
export async function phase(name, fn, info = {}) {
  if (!run) return fn();
  const at = performance.now();
  const entry = { name, at: ms(at - run.t0), ms: 0, ...info };
  try {
    return await fn();
  } catch (e) {
    entry.failed = true;
    throw e;
  } finally {
    entry.ms = ms(performance.now() - at);
    run.phases.push(entry);
  }
}

/** Facts about the run worth keeping (frames rendered, the revision it made, cached builds). */
export function record(facts) {
  if (run) Object.assign(run.facts, facts);
}

export function finishRun({ error } = {}) {
  if (!run) return;
  const r = run;
  run = null;
  if (!fs.existsSync(path.join(r.root, 'storyboard.json'))) return;
  const line = {
    run: r.id,
    cmd: r.cmd,
    args: r.args,
    startedAt: r.startedAt,
    endedAt: new Date().toISOString(),
    ms: ms(performance.now() - r.t0),
    status: error ? 'failed' : 'ok',
    ...(error ? { error: String(error.message ?? error).split('\n')[0].slice(0, 300) } : {}),
    phases: r.phases,
    ...r.facts,
    host: { cpus: os.cpus().length, memoryGiB: Math.round(os.totalmem() / 2 ** 30), platform: process.platform },
  };
  const file = reviewPath(r.root, 'runlog.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(line) + '\n');
}

export function readRunlog(root) {
  const file = reviewPath(root, 'runlog.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap(l => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

/**
 * Observed command time, phase totals, the gaps between commands (inferred, not measured)
 * and wall-clock milestones: the first reviewable cut and the first final.
 */
export function runlogReport(entries, revisions = []) {
  const runs = [...entries].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const gaps = [];
  for (let i = 1; i < runs.length; i++) {
    const g = Date.parse(runs[i].startedAt) - Date.parse(runs[i - 1].endedAt);
    if (g > 0) gaps.push({ before: runs[i].cmd, at: runs[i].startedAt, ms: g });
  }
  const phases = {};
  for (const r of runs)
    for (const p of r.phases ?? []) {
      phases[p.name] ??= { ms: 0, count: 0 };
      phases[p.name].ms += p.ms;
      phases[p.name].count++;
    }
  const first = runs[0] ? Date.parse(runs[0].startedAt) : null;
  const milestone = test => {
    const r = revisions.find(test);
    return r && first != null
      ? { revision: r.id, at: r.createdAt, sinceFirstCommandMs: Date.parse(r.createdAt) - first }
      : null;
  };
  const hasVideo = (r, profile) => (r.videos ?? []).some(v => !profile || v.profile === profile);
  return {
    commands: runs.length,
    firstAt: runs[0]?.startedAt ?? null,
    lastAt: runs.at(-1)?.endedAt ?? null,
    wallMs: runs.length ? Date.parse(runs.at(-1).endedAt) - first : 0,
    measuredMs: runs.reduce((s, r) => s + (r.ms ?? 0), 0),
    gapMs: gaps.reduce((s, g) => s + g.ms, 0),
    gaps,
    phases,
    failed: runs.filter(r => r.status === 'failed').length,
    milestones: {
      firstReviewableCut: milestone(r => hasVideo(r)),
      firstRoughCut: milestone(r => hasVideo(r, 'rough')),
      firstFinal: milestone(r => hasVideo(r, 'final')),
    },
    runs,
  };
}
