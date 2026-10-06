// A minimal DevTools client shared by the demo scripts (demo-captures, demo-clips): reuse a Chrome
// started with --remote-debugging-port, or launch one headless (CHROME or the macOS default path).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function chrome(cdp) {
  if (cdp) return { base: cdp.replace(/\/$/, ''), stop() {} };
  const bin = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', port = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-demo-chrome-'));
  const p = spawn(bin, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(200); } }
  return { base: `http://127.0.0.1:${port}`, stop() { p.kill(); fs.rmSync(profile, { recursive: true, force: true }); } };
}
export async function tab(base) {
  const t = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { const { ok, no } = wait.get(d.id); wait.delete(d.id); d.error ? no(new Error(d.error.message)) : ok(d.result); } };
  const send = (method, params = {}) => new Promise((ok, no) => { const n = ++id; wait.set(n, { ok, no }); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (fn, ...args) => { const r = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'page error'); return r.result.value; };
  return { send, evaluate, close: async () => { ws.close(); await fetch(`${base}/json/close/${t.id}`).catch(() => {}); } };
}

