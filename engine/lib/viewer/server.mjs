// Serve the viewer and studio on localhost: notes save into each film, studio commands edit
// the working copy, studio jobs render native previews.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { studioState, studioCommand, studioSchema } from './studio.mjs';
import { createStudioJobs } from './studio-jobs.mjs';
import { rel } from './media.mjs';
import { buildViewer, filmData } from './build.mjs';
import { saveNote, setNoteState, replyToNote, loadViewerNotes } from './notes.mjs';
import { addDecision, setNoteStatus, readDecisions, readKeeps } from '../notes.mjs';
import { checkId } from '../store.mjs';
import { soundState } from './sound.mjs';
import { startSound, spendLog, answerSpend } from './spend.mjs';
import { createRuntime, agentPaths } from '../agent/runtime.mjs';
import { createAgent } from '../agent/agent.mjs';
import { projectsRoot, createProject, findCreated, uploadToProject, uploadToDraft } from '../agent/projects.mjs';

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('Request too large.'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('That request is not JSON.'), { status: 400 })); } });
    req.on('error', reject);
  });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.vtt': 'text/vtt', '.srt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

export async function serveViewer({ root, out = 'build/viewer', port = 4317, render = true, projects, agent: withAgent = true, runtime: injectedRuntime } = {}) {
  const base = process.cwd();
  // Films made in the browser live under one projects root, found again on every start.
  const paths = agentPaths(base);
  // One studio per working folder owns the agent bridge; a second one (or a test) never takes it over.
  const peer = (() => { try { const b = JSON.parse(fs.readFileSync(paths.bridge, 'utf8')); if (b.pid !== process.pid) { process.kill(b.pid, 0); return b; } } catch {} return null; })();
  const agentOff = !withAgent ? 'Started with --no-agent.' : peer ? `Another ClearFrame studio (process ${peer.pid}, ${peer.url}) runs this folder's agent. Use that one, or stop it and restart this one.` : null;
  const projectRoot = projectsRoot(base, projects);
  if (!agentOff) fs.mkdirSync(projectRoot, { recursive: true });
  const given = root == null ? ['examples', 'real-examples'] : Array.isArray(root) ? root : [root];
  const roots = [...new Set([...given.map(r => path.resolve(r)), ...(fs.existsSync(projectRoot) ? [projectRoot] : [])])];
  let built = await buildViewer({ root: roots, out, render });
  const rebuild = async () => { built = await buildViewer({ root: roots, out, render: false }); agent?.reindex(); return built; };
  const jobs = createStudioJobs({ base, out: path.resolve(out), onDone: async j => { if (['draft', 'final', 'revise', 'reject'].includes(j.kind)) await rebuild(); } });
  const dirOf = id => (typeof id === 'string' && Object.hasOwn(built.dirs, id) ? built.dirs[id] : null);
  const filmOf = dir => { const id = Object.keys(built.dirs).find(k => built.dirs[k] === dir); const f = id && built.data.films.find(x => x.id === id); return id ? { id, title: f?.title ?? path.basename(dir), folder: path.relative(base, dir) } : null; };
  const pauseOf = dir => { const j = jobs.pausing(dir); return j ? { id: j.id, kind: j.kind, label: j.label } : null; };
  // The agent runtime starts on demand: the first message, or opening a film that already has a conversation.
  const runtime = agentOff ? null : injectedRuntime ?? createRuntime({ base });
  const agent = runtime ? createAgent({ base, runtime, jobs, dirs: () => Object.values(built.dirs), filmOf, pauseOf }) : null;
  agent?.reindex();
  // The plugin reaches this server with a token only it and this process know (file mode 600, dot folder).
  const token = crypto.randomBytes(32).toString('hex');
  const bridgeAuth = h => { const want = Buffer.from(`Bearer ${token}`), got = Buffer.from(String(h ?? '')); return got.length === want.length && crypto.timingSafeEqual(got, want); };
  const server = http.createServer(async (req, res) => {
    const reply = (code, body) => { if (res.headersSent) return; res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) { res.writeHead(403); return res.end('Local studio requests only'); }
      let url;
      try { url = new URL(req.url, 'http://localhost'); decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
      if (url.pathname.startsWith('/api/')) return await api(req, res, url, reply);
      return serveStatic(req, res, url);
    } catch (e) { reply(e.status ?? 500, { error: e.message }); }
  });

  async function api(req, res, url, reply) {
    const p = url.pathname;
    if (req.method === 'GET') {
      if (p === '/api/ping') return reply(200, { ok: true, studio: true });
      if (p === '/api/studio/schema') return reply(200, studioSchema());
      if (p === '/api/studio/jobs') return reply(200, { jobs: jobs.list(url.searchParams.get('film')) });
      if (p === '/api/films') return reply(200, { generatedAt: built.data.generatedAt, roots: built.data.roots, films: built.data.films.map(freshNotes), projects: path.relative(base, projectRoot) || '.', agent: !!agent });
      if (p === '/api/agent/status') return reply(200, { enabled: !!agent, disabled: agentOff, runtime: runtime?.status() ?? null, projects: path.relative(base, projectRoot) || '.' });
      if (p === '/api/agent/catalog') return reply(200, await startCatalog());
      if (agent && p === '/api/agent/models') return reply(200, { models: await agent.models() });
      if (agent && p === '/api/agent/integrations') return reply(200, { integrations: await agent.integrations() });
      const dir = dirOf(url.searchParams.get('film'));
      if (!dir) return reply(404, { error: 'Unknown film' });
      if (p === '/api/notes') return reply(200, { notes: loadViewerNotes(dir) });
      if (p === '/api/studio/state') return reply(200, { ...studioState(dir), paused: pauseOf(dir) });
      if (p === '/api/studio/film') return reply(200, await filmData(dir, { out }));
      if (p === '/api/studio/sound') return reply(200, { ...soundState(dir, base), spend: spendLog(dir).slice(-20) });
      if (p === '/api/studio/review') return reply(200, { decisions: readDecisions(dir), keeps: readKeeps(dir), ...(await checkpointsOf(dir)) });
      if (agent && p === '/api/agent/conversation') return reply(200, await agent.conversation(dir));
      return reply(404, { error: 'Unknown studio endpoint' });
    }
    if (req.method !== 'POST') return reply(405, { error: 'Use GET or POST.' });
    // OpenCode's ClearFrame tools: only with the private bridge token, never from a page.
    if (p === '/api/agent/bridge') {
      if (!agent || req.headers.origin || !bridgeAuth(req.headers.authorization)) return reply(403, { error: 'Not a ClearFrame studio tool call.' });
      const body = await readJSON(req);
      try { return reply(200, await agent.bridge(body)); } catch (e) { return reply(e.status ?? 400, { error: e.message, ...(e.errors ? { errors: e.errors } : {}) }); }
    }
    // Every write is a same-origin request: a page on another site cannot post here.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) return reply(403, { error: 'Open the studio on this computer to edit.' });
    if (p === '/api/upload') {
      // Raw file bodies carry a custom header, which a cross-site form cannot send without a preflight.
      if (req.headers['x-clearframe-upload'] !== '1') return reply(403, { error: 'Upload from the studio page.' });
      const name = url.searchParams.get('name'), draft = url.searchParams.get('draft');
      try {
        if (draft) return reply(200, await uploadToDraft(paths.uploads, draft, req, name));
        const dir = dirOf(url.searchParams.get('film'));
        if (!dir) { req.resume(); return reply(404, { error: 'Unknown film' }); }
        return reply(200, await uploadToProject(dir, req, name));
      } catch (e) { req.resume(); return reply(e.status ?? 400, { error: e.message }); }
    }
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Expected a JSON request.' });
    const body = await readJSON(req);
    if (!body || typeof body !== 'object') return reply(400, { error: 'Expected a JSON object.' });
    if (p === '/api/studio/jobs/cancel') return reply(200, jobs.cancel(body.id));
    if (agent && p === '/api/projects') {
      try {
        const again = findCreated(Object.values(built.dirs), body.request);
        const dir = again ?? createProject(projectRoot, paths.uploads, body);
        if (!again) await rebuild();
        const id = Object.keys(built.dirs).find(k => built.dirs[k] === dir);
        return reply(again ? 200 : 201, { film: built.data.films.find(f => f.id === id) ?? null, id });
      } catch (e) { return reply(e.status ?? 400, { error: e.message }); }
    }
    if (agent && p === '/api/agent/start') { try { await runtime.client(); } catch {} return reply(200, { runtime: runtime.status() }); }
    if (agent && p === '/api/agent/connect') { try { return reply(200, await agent.connectKey(body)); } catch (e) { return reply(e.status ?? 400, { error: e.message }); } }
    const dir = dirOf(body.film);
    if (!dir) return reply(404, { error: 'Unknown film' });
    const notes = { '/api/notes': () => saveNote(dir, body), '/api/notes/state': () => setNoteState(dir, body.id, body), '/api/notes/reply': () => replyToNote(dir, body.id, body) };
    try {
      if (notes[p]) return reply(200, notes[p]());
      if (p === '/api/studio/jobs') return reply(202, jobs.start(dir, body)); // narration and music: /api/studio/sound only
      if (p === '/api/studio/command') {
        const paused = pauseOf(dir);
        if (paused) return reply(409, { error: `${paused.label} is using the working copy. Cancel it or wait for it to finish before editing.`, paused });
        return reply(200, { ...studioCommand(dir, body), paused: null });
      }
      if (p === '/api/studio/accept') return reply(200, accept(dir, body));
      if (p === '/api/studio/sound') return reply(202, startSound(dir, body.film, jobs, body));
      if (agent && p === '/api/agent/spend') return reply(200, answerSpend(dir, body.film, jobs, body));
      if (agent && p.startsWith('/api/agent/')) {
        const verb = p.slice('/api/agent/'.length);
        const run = { prompt: () => agent.prompt(dir, body), discard: () => agent.discard(dir, body.submission), interrupt: () => agent.interrupt(dir),
          'queue/cancel': () => agent.cancelQueued(dir, body.id), 'queue/steer': () => agent.steerQueued(dir, body.id), permission: () => agent.permission(dir, body),
          form: () => agent.form(dir, body), model: () => agent.setModel(dir, body.model), mode: () => agent.setMode(dir, body.mode), session: () => agent.session(dir).then(l => ({ linked: !!l.sessionID })) }[verb];
        if (run) return reply(200, await run());
      }
      return reply(404, { error: 'Unknown studio endpoint' });
    } catch (e) { return reply(e.status ?? 400, { error: e.message, ...(e.errors ? { errors: e.errors } : {}) }); }
  }

  /** A film with its notes as they are now (the agent answers them while the page is open), not as they were at build. */
  function freshNotes(f) {
    const dir = built.dirs[f.id];
    if (!dir || f.kind !== 'clearframe' || !f.versions.length) return f;
    let notes;
    try { notes = loadViewerNotes(dir); } catch { return f; }
    const ids = new Set(f.versions.map(v => v.id)), latest = f.versions.at(-1).id;
    return { ...f, versions: f.versions.map(v => ({ ...v, notes: [...notes.filter(n => n.version === v.id),
      ...(v.id === latest ? notes.filter(n => n.version && !ids.has(n.version)).map(n => ({ ...n, earlier: n.version, earlierAt: n.at, at: null, pin: null, element: null })) : [])] })) };
  }

  /** Starting points the new-film form offers: playbooks, treatments and directions from the library. */
  async function startCatalog() {
    const [{ playbooks }, { treatments }, { directions }] = await Promise.all([import('../../../film/playbooks.mjs'), import('../../../film/treatments.mjs'), import('../../../film/directions.mjs')]);
    return { playbooks: playbooks().map(p => ({ id: p.id, title: p.title, audience: p.audience, inputs: p.inputs })),
      treatments: treatments().map(t => ({ id: t.id, title: t.title, when: t.when ?? '' })), directions: directions().map(d => ({ id: d.id, title: d.title, when: d.when, materials: d.materials })) };
  }

  /** A person's acceptance, in their own words, exactly as `accept --by --said` records it. */
  function accept(dir, { revision, note, by, said }) {
    checkId('revision', revision);
    if (note != null) checkId('note', note);
    by = String(by ?? '').trim(); said = String(said ?? '').trim();
    if (!by || !said) throw new Error('An acceptance records who accepted and what they said.');
    const d = addDecision(dir, { action: 'accept', role: 'human', by, said, revision, scope: note ? { note } : {} });
    if (note) setNoteStatus(dir, note, 'accepted', { revision, by });
    return { decision: d };
  }
  async function checkpointsOf(dir) {
    try { const { checkpoints } = await import('../checkpoints.mjs'); return { checkpoints: checkpoints(dir, { mode: 'guided' }) }; }
    catch (e) { return { checkpoints: [], checkpointsError: e.message }; }
  }

  /**
   * Active content the studio did not write (an uploaded or downloaded HTML page, an SVG) opens
   * sandboxed: a unique origin with no scripts, so it can never call this server's write API.
   * The viewer's own pages (build/viewer) and the engine's review pages (a film's review/) run normally.
   */
  const viewerDir = path.resolve(out);
  function guard(file, type) {
    const h = { 'x-content-type-options': 'nosniff' };
    if (!/^(text\/html|image\/svg\+xml)/.test(type)) return h;
    const own = file.startsWith(viewerDir + path.sep) || path.relative(base, file).split(path.sep).includes('review');
    return own ? h : { ...h, 'content-security-policy': "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline' 'self'; media-src 'self'; font-src 'self'" };
  }

  // Static files under the working folder, never dotfiles; byte ranges so videos scrub.
  function serveStatic(req, res, url) {
    // Keep document-relative film media and fonts relative to the built viewer directory.
    if (url.pathname === '/') { res.writeHead(302, { location: '/' + rel(base, built.file).split('/').map(encodeURIComponent).join('/') }); return res.end(); }
    const wanted = decodeURIComponent(url.pathname);
    const file = path.resolve(base, '.' + wanted);
    const hidden = path.relative(base, file).split(path.sep).some(s => s.startsWith('.'));
    if (!file.startsWith(base + path.sep) || hidden || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    const size = fs.statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2])), end = range[1] && range[2] ? Number(range[2]) : size - 1;
      end = Math.min(end, size - 1);
      if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1, ...guard(file, type) });
      return fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', ...guard(file, type), ...(type.startsWith('text/html') ? { 'cache-control': 'no-store' } : {}) });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  await new Promise((resolve, reject) => {
    server.once('error', e => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use (another viewer may be running). Stop it or pass --port.`) : e));
    server.listen(port, '127.0.0.1', resolve);
  });
  // The OpenCode plugin finds this server through a private file; a restart writes a new token.
  if (agent) fs.mkdirSync(paths.agent, { recursive: true });
  if (agent) fs.writeFileSync(paths.bridge, JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, token, pid: process.pid, startedAt: new Date().toISOString() }), { mode: 0o600 });
  // Render children belong to this server: stop them with it. The OpenCode service is shared and
  // keeps conversations running; `clearframe agent stop` stops it.
  const stop = () => { jobs.stopAll(); try { if (JSON.parse(fs.readFileSync(paths.bridge, 'utf8')).token === token) fs.rmSync(paths.bridge, { force: true }); } catch {} };
  server.on('close', stop);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(128 + (sig === 'SIGINT' ? 2 : 15)); });
  return { server, jobs, runtime, agent, projects: projectRoot, url: `http://127.0.0.1:${port}/${rel(base, built.file)}`, ...built };
}
