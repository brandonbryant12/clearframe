// Tiny static server: serves a project folder plus the ClearFrame runtime, GSAP and fonts
// from node_modules, so renders never depend on a CDN. Supports Range requests (needed
// for <video>/<audio> seeking in Chrome) and optional live-reload for previews.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { sfxFile, SFX } from './sfx.mjs';
import { computeTiming } from './timing.mjs';
import { ENGINE_DIR, require } from './util.mjs';

// One script tag for everything: GSAP + plugins + ClearFrame runtime + kit.
const BUNDLE = [
  ['gsap', 'dist/gsap.min.js'], ['gsap', 'dist/SplitText.min.js'], ['gsap', 'dist/CustomEase.min.js'], ['gsap', 'dist/MotionPathPlugin.min.js'],
  [null, 'cf.js'], [null, 'cf-kit.js'], [null, 'cf-kit-plus.js'],
];
function bundle() {
  return BUNDLE.map(([pkg, rel]) => {
    const file = pkg ? path.join(pkgDir(pkg), rel) : path.join(ENGINE_DIR, 'runtime', rel);
    return `/* ${pkg ?? 'clearframe'}/${rel} */\n${fs.readFileSync(file, 'utf8')}\n`;
  }).join(';\n');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

function mounts() {
  const m = { '/_cf/vendor/gsap/': path.join(pkgDir('gsap'), 'dist') };
  const fonts = {
    inter: '@fontsource-variable/inter',
    'instrument-serif': '@fontsource/instrument-serif',
    'jetbrains-mono': '@fontsource-variable/jetbrains-mono',
    fraunces: '@fontsource-variable/fraunces',
  };
  for (const [alias, pkg] of Object.entries(fonts)) {
    try { m[`/_cf/fonts/${alias}/`] = pkgDir(pkg); } catch { /* optional font not installed */ }
  }
  try { m['/_cf/icons/'] = path.join(pkgDir('lucide-static'), 'icons'); } catch { /* icons optional */ }
  m['/_cf/'] = path.join(ENGINE_DIR, 'runtime');
  return m;
}

function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p === base || p.startsWith(base + path.sep) ? p : null;
}

function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end(`Not found: ${req.url}`); }
    const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const headers = { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      let start = range[1] ? parseInt(range[1], 10) : 0;
      let end = range[2] ? parseInt(range[2], 10) : st.size - 1;
      if (!range[1] && range[2]) { start = st.size - parseInt(range[2], 10); end = st.size - 1; }
      if (start >= st.size || end >= st.size || start > end) {
        res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end();
      }
      res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/**
 * Start serving `root`. Returns { url, port, close }.
 * @param {string} root project folder
 * @param {{port?: number, live?: boolean}} opts live=true enables file-watch reload events
 */
export function serve(root, { port = 0, live = false } = {}) {
  const table = Object.entries(mounts()).sort((a, b) => b[0].length - a[0].length);
  const clients = new Set();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/_cf/timing.json') {
      try {
        const body = JSON.stringify(computeTiming(root));
        res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
        return res.end(body);
      } catch (e) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        return res.end(String(e.message));
      }
    }
    if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (pathname === '/_cf/all.js') {
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
      return res.end(bundle());
    }
    const sfx = pathname.match(/^\/_cf\/sfx\/([a-z-]+)\.wav$/);
    if (sfx && SFX[sfx[1]]) {
      sfxFile(sfx[1]).then((f) => sendFile(req, res, f), (e) => { res.writeHead(500); res.end(String(e.message)); });
      return;
    }
    if ((pathname === '/' || pathname === '/index.html') && !fs.existsSync(path.join(root, 'index.html'))) {
      return sendFile(req, res, path.join(ENGINE_DIR, 'runtime', 'default.html')); // storyboard-only projects
    }
    if (pathname === '/_cf/data.json') { // optional project data; null when absent
      const f = path.join(root, 'data.json');
      if (fs.existsSync(f)) return sendFile(req, res, f);
      res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
      return res.end('null');
    }
    if (pathname === '/_cf/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write(`data: ${live ? 'hello' : 'static'}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    for (const [prefix, dir] of table) {
      if (pathname.startsWith(prefix)) {
        const file = safeJoin(dir, pathname.slice(prefix.length));
        return file ? sendFile(req, res, file) : (res.writeHead(403), res.end());
      }
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = safeJoin(root, pathname);
    return file ? sendFile(req, res, file) : (res.writeHead(403), res.end());
  });

  let watcher;
  if (live) {
    let timer;
    watcher = fs.watch(root, { recursive: true }, (_evt, name) => {
      if (!name || name.startsWith('build') || name.includes('node_modules')) return;
      clearTimeout(timer);
      timer = setTimeout(() => { for (const c of clients) c.write(`data: reload ${name}\n\n`); }, 120);
    });
  }

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        port: actual,
        url: `http://127.0.0.1:${actual}/`,
        close: () => new Promise((r) => { watcher?.close(); for (const c of clients) c.end(); server.close(() => r()); server.closeAllConnections?.(); }),
      });
    });
  });
}
