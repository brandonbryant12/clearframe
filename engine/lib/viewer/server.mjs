// Serve the viewer on localhost so notes save into each film.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { rel } from './media.mjs';
import { buildViewer } from './build.mjs';
import { saveNote, setNoteState, replyToNote } from './notes.mjs';

export async function serveViewer({ root, out = 'build/viewer', port = 4317, render = true } = {}) {
  const base = process.cwd(), built = await buildViewer({ root, out, render });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const reply = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/api/ping') return reply(200, { ok: true });
    const actions = { '/api/notes': (dir, b) => saveNote(dir, b), '/api/notes/state': (dir, b) => setNoteState(dir, b.id, b), '/api/notes/reply': (dir, b) => replyToNote(dir, b.id, b) };
    if (actions[url.pathname] && req.method === 'POST') {
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try {
          const body = JSON.parse(raw), dir = built.dirs[body.film];
          if (!dir) return reply(404, { error: 'Unknown film' });
          reply(200, actions[url.pathname](dir, body));
        } catch (e) { reply(400, { error: e.message }); }
      });
      return;
    }
    // Static files under the working folder only; ranges so videos scrub.
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname === '/' ? `/${rel(base, built.file)}` : url.pathname));
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    const size = fs.statSync(file).size, type = types[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', e => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use (another viewer may be running). Stop it or pass --port.`) : e));
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${port}/${rel(base, built.file)}`, ...built };
}

