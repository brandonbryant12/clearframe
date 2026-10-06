// Serve the viewer and studio on localhost: notes save into each film, studio commands edit
// the working copy, studio jobs render native previews.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { studioState, studioCommand, studioSchema } from './studio.mjs';
import { createStudioJobs } from './studio-jobs.mjs';
import { rel } from './media.mjs';
import { buildViewer, filmData } from './build.mjs';
import { saveNote, setNoteState, replyToNote, loadViewerNotes } from './notes.mjs';
import { addDecision, setNoteStatus, readDecisions, readKeeps } from '../notes.mjs';
import { checkId } from '../store.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
  '.vtt': 'text/vtt', '.srt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

export async function serveViewer({ root, out = 'build/viewer', port = 4317, render = true } = {}) {
  const base = process.cwd(); let built = await buildViewer({ root, out, render });
  const jobs = createStudioJobs({ base, out: path.resolve(out), onDone: async j => { if (['draft', 'final', 'revise', 'reject'].includes(j.kind)) built = await buildViewer({ root, out, render: false }); } });
  const dirOf = id => (typeof id === 'string' && Object.hasOwn(built.dirs, id) ? built.dirs[id] : null);
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
      const dir = dirOf(url.searchParams.get('film'));
      if (!dir) return reply(404, { error: 'Unknown film' });
      if (p === '/api/notes') return reply(200, { notes: loadViewerNotes(dir) });
      if (p === '/api/studio/state') return reply(200, { ...studioState(dir), paused: pauseOf(dir) });
      if (p === '/api/studio/film') return reply(200, await filmData(dir, { out }));
      if (p === '/api/studio/review') return reply(200, { decisions: readDecisions(dir), keeps: readKeeps(dir), ...(await checkpointsOf(dir)) });
      return reply(404, { error: 'Unknown studio endpoint' });
    }
    if (req.method !== 'POST') return reply(405, { error: 'Use GET or POST.' });
    // Every write is a same-origin JSON request: a page on another site cannot post here.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) return reply(403, { error: 'Open the studio on this computer to edit.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'Expected a JSON request.' });
    const body = await new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 1e6) { reject(Object.assign(new Error('Request too large.'), { status: 413 })); req.destroy(); } });
      req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(Object.assign(new Error('That request is not JSON.'), { status: 400 })); } });
      req.on('error', reject);
    });
    if (!body || typeof body !== 'object') return reply(400, { error: 'Expected a JSON object.' });
    if (p === '/api/studio/jobs/cancel') return reply(200, jobs.cancel(body.id));
    const dir = dirOf(body.film);
    if (!dir) return reply(404, { error: 'Unknown film' });
    const notes = { '/api/notes': () => saveNote(dir, body), '/api/notes/state': () => setNoteState(dir, body.id, body), '/api/notes/reply': () => replyToNote(dir, body.id, body) };
    try {
      if (notes[p]) return reply(200, notes[p]());
      if (p === '/api/studio/jobs') return reply(202, jobs.start(dir, body));
      if (p === '/api/studio/command') {
        const paused = pauseOf(dir);
        if (paused) return reply(409, { error: `${paused.label} is using the working copy. Cancel it or wait for it to finish before editing.`, paused });
        return reply(200, { ...studioCommand(dir, body), paused: null });
      }
      if (p === '/api/studio/accept') return reply(200, accept(dir, body));
      return reply(404, { error: 'Unknown studio endpoint' });
    } catch (e) { return reply(e.status ?? 400, { error: e.message, ...(e.errors ? { errors: e.errors } : {}) }); }
  }
  const pauseOf = dir => { const j = jobs.pausing(dir); return j ? { id: j.id, kind: j.kind, label: j.label } : null; };

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
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', ...(type.startsWith('text/html') ? { 'cache-control': 'no-store' } : {}) });
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  await new Promise((resolve, reject) => {
    server.once('error', e => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use (another viewer may be running). Stop it or pass --port.`) : e));
    server.listen(port, '127.0.0.1', resolve);
  });
  // Render children belong to this server: stop them with it.
  const stop = () => jobs.stopAll();
  server.on('close', stop);
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { stop(); process.exit(128 + (sig === 'SIGINT' ? 2 : 15)); });
  return { server, jobs, url: `http://127.0.0.1:${port}/${rel(base, built.file)}`, ...built };
}
