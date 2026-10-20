// Two small supervisors keep ownership across gates that create a new process session.
// The outer process has IPC to the ledger owner. The worker leads the actual CLI's group.
// Both PIDs are committed before "run" reaches the worker. EOF stops work even after SIGKILL.
import { spawn } from 'node:child_process';

const [mode, command, ...args] = process.argv.slice(2);
const signalGroup = (pid, signal) => { if (Number.isInteger(pid) && pid > 0) try { process.kill(-pid, signal); } catch {} };

if (mode === '--worker') {
  let child, stopping = false, timer;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (!child) process.exit(1);
    signalGroup(process.pid, 'SIGTERM');
    timer = setTimeout(() => signalGroup(process.pid, 'SIGKILL'), 8000);
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  process.stdin.on('end', stop);
  let input = '';
  process.stdin.on('data', chunk => {
    if (child || stopping) return;
    input += chunk;
    if (!input.includes('\n')) return;
    if (input !== 'run\n') return stop();
    child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', error => console.error(error.message));
    child.once('close', (code, signal) => {
      if (stopping) signalGroup(process.pid, 'SIGKILL');
      clearTimeout(timer);
      process.exit(signal || stopping ? 1 : code ?? 1);
    });
  });
  process.stdout.write(`CLEARFRAME_WORKER ${process.pid}\n`);
} else {
  let child, workerPid, stopping = false, timer, launched = false, pending = '';
  const stop = () => {
    if (stopping) return;
    stopping = true;
    if (!child) process.exit(1);
    child.stdin?.end();
    signalGroup(workerPid, 'SIGTERM');
    signalGroup(mode === '--gated' ? process.pid : child.pid, 'SIGTERM');
    timer = setTimeout(() => {
      signalGroup(workerPid, 'SIGKILL');
      signalGroup(mode === '--gated' ? process.pid : child.pid, 'SIGKILL');
      process.exit(1);
    }, 8500);
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop); process.on('disconnect', stop);
  process.on('message', message => {
    if (message?.type === 'run' && workerPid && !stopping && !launched) {
      launched = true; child.stdin.write('run\n'); return;
    }
    if (message?.type !== 'start' || child || stopping) return;
    // A gate owns a separate worker session; direct workers create their own group here.
    child = spawn(command, args, { detached: mode !== '--gated', stdio: ['pipe', 'pipe', 'inherit'] });
    child.stdin?.on('error', stop);
    child.stdout?.on('data', chunk => {
      if (workerPid) return process.stdout.write(chunk);
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        const match = /^CLEARFRAME_WORKER (\d+)$/.exec(line);
        if (!match) { process.stdout.write(`${line}\n`); continue; } // gate waiting notices
        workerPid = Number(match[1]);
        if (stopping || !process.connected) return stop();
        process.send({ type: 'worker', pid: workerPid }, error => { if (error) stop(); });
        if (pending) process.stdout.write(pending);
        pending = ''; break;
      }
    });
    child.once('error', error => console.error(error.message));
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (stopping) signalGroup(workerPid, 'SIGKILL');
      process.exit(signal || stopping ? 1 : code ?? 1);
    });
  });
}
