import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { errorMessage, isRecord, type HarnessJob } from './contracts.mjs';
import { signalChild, KINDS, required, jobArguments } from './job-inputs.mjs';
import { pin, approvalMatches, finish } from './job-results.mjs';
import type { HarnessContext } from './job-state.mjs';
const CHILD = fileURLToPath(
  new URL(
    import.meta.url.endsWith('.mts') ? './child.mts' : './child.mjs',
    import.meta.url,
  ),
);
export function createJobRunner(
  context: HarnessContext,
  {
    cli,
    gate,
    onDone,
  }: {
    cli: string;
    gate: string | null;
    onDone: (job: HarnessJob) => void | Promise<void>;
  },
) {
  const { base, state, queue, persist, evict } = context;
  function next(): void {
    if (state.stopped || state.storageError || state.running || !queue.length)
      return;
    const j = queue.shift();
    if (!j) return;
    state.running = j;
    j.status = 'running';
    j.startedAt = new Date().toISOString();
    pin(j);
    // A paid run generates exactly what was approved, or nothing: refuse here if it changed while
    // queued; the engine checks again after any wait for the heavy-work gate (CLEARFRAME_APPROVED_SOUND).
    if (!approvalMatches(j)) {
      state.running = null;
      persist();
      return next();
    }
    const gated = KINDS[j.kind].heavy && !!gate && fs.existsSync(gate);
    const a = [cli, ...jobArguments(j)];
    // Detached: the child leads its own process group, so cancelling reaches the renderer too.
    // Commit running state before creating a supervisor. The supervisor waits for a start message
    // until its PID is committed, so a crash between spawn and persistence cannot launch the CLI.
    persist();
    const command = gated ? required(gate, 'gate') : process.execPath;
    const workerArgs = [CHILD, '--worker', process.execPath, ...a];
    const commandArgs = gated
      ? ['--', process.execPath, ...workerArgs]
      : workerArgs;
    let child;
    try {
      child = spawn(
        process.execPath,
        [CHILD, gated ? '--gated' : '--direct', command, ...commandArgs],
        {
          cwd: base,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: {
            ...process.env,
            ...(gated ? { CLEARFRAME_HEAVY_HELD: '1' } : {}),
            NO_COLOR: '1',
            FORCE_COLOR: '0',
            ...(j.paid
              ? {
                  CLEARFRAME_APPROVED_SOUND: JSON.stringify({
                    kind: j.kind,
                    specs: j.approval?.basis.specs,
                  }),
                }
              : {}),
          },
        },
      );
    } catch (error) {
      j.status = 'failed';
      j.finishedAt = new Date().toISOString();
      j.errors = [errorMessage(error)];
      state.running = null;
      persist();
      next();
      return;
    }
    j.child = child;
    j.childPid = child.pid ?? null;
    let settle: () => void = () => {};
    j.settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    child.on('message', (message) => {
      if (
        !isRecord(message) ||
        message.type !== 'worker' ||
        typeof message.pid !== 'number' ||
        !Number.isSafeInteger(message.pid) ||
        message.pid <= 0 ||
        j.workerPid
      )
        return;
      j.workerPid = message.pid;
      try {
        persist();
        if (!state.stopped && !j.cancelled) child.send({ type: 'run' });
        else signalChild(child, 'SIGTERM');
      } catch (error) {
        signalChild(child, 'SIGTERM');
        console.error(errorMessage(error));
      }
    });
    const log = (c: Buffer) => {
      const text = c.toString();
      j.log = (j.log + text).slice(-16000);
      const frames = [...text.matchAll(/frames (\d+)\/(\d+)/g)].at(-1);
      if (frames)
        j.progress = Number(frames[1]) / Math.max(1, Number(frames[2]));
      const before = j.status;
      if (/Waiting for another local build/.test(text)) j.status = 'waiting';
      else if (j.status === 'waiting' && text.trim()) j.status = 'running';
      if (before !== j.status) {
        try {
          persist();
        } catch (e) {
          signalChild(child, 'SIGTERM');
          console.error(errorMessage(e));
        }
      }
    };
    child.stdout?.on('data', log);
    child.stderr?.on('data', log);
    child.once('error', (e) => {
      j.log += `\n${errorMessage(e)}`;
      j.errors = [e.message];
    });
    child.once('close', async (code) => {
      clearTimeout(j.killTimer);
      try {
        j.finishedAt = new Date().toISOString();
        j.status = code === 0 ? 'complete' : 'failed';
        if (j.cancelled) j.status = 'cancelled';
        if (j.status === 'failed')
          j.errors = (j.errors ?? [])
            .concat(
              [...j.log.matchAll(/^\s*✗ (.+)$/gm)].map((m) => m[1]),
              j.log.match(/^Error: (.+)$/m)?.[1] ?? [],
            )
            .slice(0, 12);
        if (j.status === 'complete') {
          try {
            finish(j, context);
          } catch (e) {
            j.status = 'failed';
            j.log += `\n${errorMessage(e)}`;
          }
        }
        // Keep partial output as evidence. Commit every terminal state before history eviction.
        persist();
        if (j.status === 'complete') {
          try {
            await onDone(j);
          } catch (e) {
            j.log += `\nCould not refresh the studio: ${errorMessage(e)}`;
          }
        }
      } catch (e) {
        console.error(`Job ledger: ${errorMessage(e)}`);
      } finally {
        delete j.child;
        if (state.running === j) state.running = null;
        evict();
        try {
          next();
        } catch (e) {
          console.error(`Job ledger: ${errorMessage(e)}`);
        }
        settle();
      }
    });
    // An asynchronous spawn failure emits error/close but has no PID or IPC channel.
    if (child.pid == null || !Number.isSafeInteger(child.pid) || child.pid <= 0)
      return;
    try {
      persist();
      child.send({ type: 'start' });
    } catch (e) {
      signalChild(child, 'SIGTERM');
      throw e;
    }
  }

  return next;
}
