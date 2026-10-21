import { createStaticServer } from './static.mjs';
// Serve the viewer and studio on localhost: notes save into each film, studio commands edit
// the working copy, studio jobs render native previews.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import { errorMessage, errorStatus, errorCode } from '../harness/contracts.mjs';
import { BridgeFileSchema } from './http-contracts.mjs';
import type { AgentRuntime } from '../agent/runtime.mjs';
import { createStudioJobs } from './studio-jobs.mjs';
import { rel } from './media.mjs';
import { buildViewer } from './build.mjs';
import { createRuntime, agentPaths } from '../agent/runtime.mjs';
import { createAgent } from '../agent/agent.mjs';
import { projectsRoot } from '../agent/projects.mjs';
import { serveApi, type Reply, type ViewerApi } from './api.mjs';
import { onCommandShutdown } from '../command-scope.mjs';
export interface ViewerOptions {
  root?: string | readonly string[];
  out?: string;
  port?: number;
  render?: boolean;
  projects?: string;
  agent?: boolean;
  runtime?: AgentRuntime;
}

export async function serveViewer({
  root,
  out = 'build/viewer',
  port = 4317,
  render = true,
  projects,
  agent: withAgent = true,
  runtime: injectedRuntime,
}: ViewerOptions = {}) {
  const base = process.cwd();
  // Films made in the browser live under one projects root, found again on every start.
  const paths = agentPaths(base);
  // One studio per working folder owns the agent bridge; a second one (or a test) never takes it over.
  const peer = (() => {
    try {
      const b = Schema.decodeUnknownSync(BridgeFileSchema)(
        JSON.parse(fs.readFileSync(paths.bridge, 'utf8')),
      );
      if (b.pid !== process.pid) {
        process.kill(b.pid, 0);
        return b;
      }
    } catch {}
    return null;
  })();
  let agentOff = peer
    ? `Another ClearFrame studio (process ${peer.pid}, ${peer.url}) runs this folder's agent. Use that one, or stop it and restart this one.`
    : null;
  if (!withAgent) agentOff = 'Started with --no-agent.';
  const projectRoot = projectsRoot(base, projects);
  if (!agentOff) fs.mkdirSync(projectRoot, { recursive: true });
  const selected = root ?? ['examples', 'real-examples'];
  const given = typeof selected === 'string' ? [selected] : selected;
  const roots = [
    ...new Set([
      ...given.map((r) => path.resolve(r)),
      ...(fs.existsSync(projectRoot) ? [projectRoot] : []),
    ]),
  ];
  let built = await buildViewer({ root: roots, out, render });
  const rebuild = async () => {
    built = await buildViewer({ root: roots, out, render: false });
    agent?.reindex();
    return built;
  };
  const jobs = createStudioJobs({
    base,
    out: path.resolve(out),
    onDone: async (j) => {
      if (['draft', 'final', 'revise', 'reject'].includes(j.kind))
        await rebuild();
    },
  });
  const dirOf = (id: unknown) =>
    typeof id === 'string' && Object.hasOwn(built.dirs, id)
      ? built.dirs[id]
      : null;
  const filmOf = (dir: string) => {
    const id = Object.keys(built.dirs).find((k) => built.dirs[k] === dir);
    const f = id ? built.data.films.find((x) => x.id === id) : undefined;
    return id
      ? {
          id,
          title: f?.title ?? path.basename(dir),
          folder: path.relative(base, dir),
        }
      : null;
  };
  const pauseOf = (dir: string) => {
    const j = jobs.pausing(dir);
    return j ? { id: j.id, kind: j.kind, label: j.label } : null;
  };
  // The agent runtime starts on demand: the first message, or opening a film that already has a conversation.
  let agent: ReturnType<typeof createAgent> | null,
    runtime: AgentRuntime | null;
  try {
    runtime = agentOff ? null : (injectedRuntime ?? createRuntime({ base }));
    agent = runtime
      ? createAgent({
          base,
          runtime,
          jobs,
          dirs: () => Object.values(built.dirs),
          filmOf,
          pauseOf,
        })
      : null;
    agent?.reindex();
  } catch (error) {
    await jobs.stopAll();
    throw error;
  }
  // The plugin reaches this server with a token only it and this process know (file mode 600, dot folder).
  const token = crypto.randomBytes(32).toString('hex');
  const bridgeAuth = (h: unknown) => {
    const want = Buffer.from(`Bearer ${token}`),
      got = Buffer.from(String(h ?? ''));
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  };
  const apiContext: ViewerApi = {
    base,
    out,
    projectRoot,
    paths,
    jobs,
    agent,
    runtime,
    agentOff,
    built: () => built,
    rebuild,
    dirOf,
    pauseOf,
    bridgeAuth,
  };
  const serveStatic = createStaticServer(base, out, () => built.file);
  const server = http.createServer(async (req, res) => {
    const reply: Reply = (code, body) => {
      if (res.headersSent) return;
      res.writeHead(code, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) {
        res.writeHead(403);
        return res.end('Local studio requests only');
      }
      let url;
      try {
        url = new URL(req.url ?? '/', 'http://localhost');
        decodeURIComponent(url.pathname);
      } catch {
        res.writeHead(400);
        return res.end('Bad request');
      }
      if (url.pathname.startsWith('/api/'))
        return await serveApi(apiContext, req, url, reply);
      return serveStatic(req, res, url);
    } catch (e) {
      reply(errorStatus(e) ?? 500, { error: errorMessage(e) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', (e) =>
      reject(
        errorCode(e) === 'EADDRINUSE'
          ? new Error(
              `Port ${port} is in use (another viewer may be running). Stop it or pass --port.`,
            )
          : e,
      ),
    );
    server.listen(port, '127.0.0.1', resolve);
  }).catch(async (error) => {
    await jobs.stopAll();
    throw error;
  });
  // The OpenCode plugin finds this server through a private file; a restart writes a new token.
  if (agent) fs.mkdirSync(paths.agent, { recursive: true });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('The studio did not obtain a local port.');
  if (agent)
    fs.writeFileSync(
      paths.bridge,
      JSON.stringify({
        url: `http://127.0.0.1:${address.port}`,
        token,
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
  // Render children belong to this server: stop them with it. The OpenCode service is shared and
  // keeps conversations running; `clearframe agent stop` stops it.
  let stopping: Promise<void> | undefined;
  const release = async () => {
    await jobs.stopAll();
    try {
      if (
        Schema.decodeUnknownSync(BridgeFileSchema)(
          JSON.parse(fs.readFileSync(paths.bridge, 'utf8')),
        ).token === token
      )
        fs.rmSync(paths.bridge, { force: true });
    } catch {}
  };
  const stop = () => (stopping ??= release());
  const managed = onCommandShutdown(async () => {
    try {
      await stop();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  const signals = (managed ? [] : (['SIGINT', 'SIGTERM'] as const)).map(
    (sig): [NodeJS.Signals, () => void] => {
      const handler = () => {
        stop()
          .catch((e) => console.error(errorMessage(e)))
          .finally(() => process.exit(128 + (sig === 'SIGINT' ? 2 : 15)));
      };
      process.once(sig, handler);
      return [sig, handler];
    },
  );
  server.on('close', () => {
    for (const [sig, handler] of signals) process.removeListener(sig, handler);
    stop().catch((e) => console.error(errorMessage(e)));
  });
  return {
    server,
    jobs,
    runtime,
    agent,
    projects: projectRoot,
    url: `http://127.0.0.1:${port}/${rel(base, built.file)}`,
    ...built,
  };
}
