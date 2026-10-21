import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { rel } from './media.mjs';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.vtt': 'text/vtt',
  '.srt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function createStaticServer(
  base: string,
  out: string,
  viewerFile: () => string,
) {
  /**
   * Active content the studio did not write (an uploaded or downloaded HTML page, an SVG) opens
   * sandboxed: a unique origin with no scripts, so it can never call this server's write API.
   * The viewer's own pages (build/viewer) and the engine's review pages (a film's review/) run normally.
   */
  const viewerDir = path.resolve(out);
  function guard(file: string, type: string) {
    const h = { 'x-content-type-options': 'nosniff' };
    if (!/^(text\/html|image\/svg\+xml)/.test(type)) return h;
    const own =
      file.startsWith(viewerDir + path.sep) ||
      path.relative(base, file).split(path.sep).includes('review');
    return own
      ? h
      : {
          ...h,
          'content-security-policy':
            "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline' 'self'; media-src 'self'; font-src 'self'",
        };
  }

  // Static files under the working folder, never dotfiles; byte ranges so videos scrub.
  function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
    // Keep document-relative film media and fonts relative to the built viewer directory.
    if (url.pathname === '/') {
      res.writeHead(302, {
        location:
          '/' +
          rel(base, viewerFile()).split('/').map(encodeURIComponent).join('/'),
      });
      return res.end();
    }
    const wanted = decodeURIComponent(url.pathname);
    const file = path.resolve(base, '.' + wanted);
    const hidden = path
      .relative(base, file)
      .split(path.sep)
      .some((s) => s.startsWith('.'));
    if (
      !file.startsWith(base + path.sep) ||
      hidden ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const size = fs.statSync(file).size,
      type =
        Object.entries(TYPES).find(
          ([extension]) => extension === path.extname(file).toLowerCase(),
        )?.[1] ?? 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      let start = range[1]
          ? Number(range[1])
          : Math.max(0, size - Number(range[2])),
        end = range[1] && range[2] ? Number(range[2]) : size - 1;
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        res.writeHead(416, { 'content-range': `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, {
        'content-type': type,
        'content-range': `bytes ${start}-${end}/${size}`,
        'accept-ranges': 'bytes',
        'content-length': end - start + 1,
        ...guard(file, type),
      });
      return fs
        .createReadStream(file, { start, end })
        .on('error', () => res.destroy())
        .pipe(res);
    }
    res.writeHead(200, {
      'content-type': type,
      'content-length': size,
      'accept-ranges': 'bytes',
      ...guard(file, type),
      ...(type.startsWith('text/html') ? { 'cache-control': 'no-store' } : {}),
    });
    fs.createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  }

  return serveStatic;
}
