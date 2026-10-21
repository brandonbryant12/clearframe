import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';

// The gate's lock is per user; platforms without POSIX user ids have no gate to inherit.
function gateLockFile(): string | null {
  const uid = process.getuid?.();
  return uid === undefined ? null : `/private/tmp/codex-heavy-${uid}.lock`;
}

// Respect an existing outer gate, including `codex-heavy -- npm ...`.
export function gateIsInherited(): boolean {
  if (process.env.CLEARFRAME_HEAVY_HELD === '1') return true;
  const lock = gateLockFile();
  if (!lock) return false;
  let owner: number;
  try {
    owner = Number(fs.readFileSync(lock, 'utf8').trim());
  } catch {
    return false;
  }
  let pid = process.ppid;
  for (let i = 0; i < 24 && pid > 1; i++) {
    if (pid === owner) return true;
    const r = spawnSync('ps', ['-o', 'ppid=', '-p', String(pid)], {
      encoding: 'utf8',
    });
    pid = Number(r.stdout?.trim());
  }
  return false;
}
export async function enterGate(): Promise<boolean> {
  const gate = path.join(os.homedir(), '.local/bin/codex-heavy');
  if (gateIsInherited()) {
    process.env.CLEARFRAME_HEAVY_HELD = '1';
    return false;
  }
  if (!fs.existsSync(gate)) return false;
  const child = spawn(
    gate,
    ['--', process.execPath, ...process.argv.slice(1)],
    {
      stdio:
        process.env.CLEARFRAME_PROGRESS_STDERR === '1'
          ? ['inherit', 'pipe', 'inherit']
          : 'inherit',
      env: { ...process.env, CLEARFRAME_HEAVY_HELD: '1' },
    },
  );
  // The gate prints its waiting notice on stdout. Keep JSON stdout clean while forwarding the result.
  if (child.stdout) {
    let pending = '';
    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString();
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end + 1);
        pending = pending.slice(end + 1);
        (line.startsWith(
          'Waiting for another local build, test suite, or install to finish...',
        )
          ? process.stderr
          : process.stdout
        ).write(line);
      }
    });
    child.stdout.on('end', () => {
      if (pending) process.stdout.write(pending);
    });
  }
  // While the gate waits, say so every 20 s and name what holds it, so a queued render is not
  // mistaken for a hang (the gate starts the command only once it holds the lock).
  const started = Date.now();
  const heartbeat = setInterval(() => {
    const running = spawnSync('pgrep', ['-P', String(child.pid)], {
      encoding: 'utf8',
    }).stdout.trim();
    if (running) return clearInterval(heartbeat);
    let holder = 'another local build or render';
    try {
      const lock = gateLockFile();
      if (!lock) throw new Error('no per-user gate lock on this platform');
      const owner = fs.readFileSync(lock, 'utf8').trim();
      const work = spawnSync('pgrep', ['-P', owner], { encoding: 'utf8' })
        .stdout.trim()
        .split('\n')[0];
      const command =
        work &&
        spawnSync('ps', ['-o', 'command=', '-p', work], {
          encoding: 'utf8',
        }).stdout.trim();
      if (command)
        holder = command.replace(/\/Users\/[^ ]*\//g, '').slice(0, 110);
    } catch {}
    const waited = Math.round((Date.now() - started) / 1000);
    process.stderr.write(
      `  queued ${waited}s behind: ${holder}. Waiting is normal; this command starts by itself when the renderer is free.\n`,
    );
  }, 20000);
  heartbeat.unref();
  const stop = () => child.kill('SIGINT'),
    terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', terminate);
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code: number | null) => resolve(code ?? 1));
  });
  clearInterval(heartbeat);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', terminate);
  return true;
}
