import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';

// Respect an existing outer gate, including `codex-heavy -- npm ...`.
export function gateIsInherited() {
  if (process.env.CLEARFRAME_HEAVY_HELD === '1') return true;
  let owner;
  try {
    owner = Number(fs.readFileSync(`/private/tmp/codex-heavy-${process.getuid()}.lock`, 'utf8').trim());
  } catch {
    return false;
  }
  let pid = process.ppid;
  for (let i = 0; i < 24 && pid > 1; i++) {
    if (pid === owner) return true;
    const r = spawnSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' });
    pid = Number(r.stdout?.trim());
  }
  return false;
}
export async function enterGate() {
  const gate = path.join(os.homedir(), '.local/bin/codex-heavy');
  if (gateIsInherited() || !fs.existsSync(gate)) return false;
  const child = spawn(gate, ['--', process.execPath, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, CLEARFRAME_HEAVY_HELD: '1' },
  });
  const stop = () => child.kill('SIGINT'),
    terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', terminate);
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve(code ?? 1));
  });
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', terminate);
  return true;
}
