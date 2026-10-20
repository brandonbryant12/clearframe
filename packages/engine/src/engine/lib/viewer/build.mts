import type { ViewerFilm } from './contracts.mjs';
// Assemble the page: every film, its versions, scenes and notes, in one self-contained HTML file.
import fs from 'node:fs';
import path from 'node:path';
import { UI, FONT_DIR, filmId } from './media.mjs';
import { FontRegistry } from './files.mjs';
import { clearframeFilm, bundled } from './clearframe.mjs';
import { manifestFilm, findFilms, briefFilm } from './manifest.mjs';

export async function buildViewer({
  root = ['examples', 'real-examples'],
  out = 'build/viewer',
  render = true,
}: { root?: string | readonly string[]; out?: string; render?: boolean } = {}) {
  const roots = (typeof root === 'string' ? [root] : root).map((r) =>
    path.resolve(r),
  );
  out = path.resolve(out);
  const media = path.join(out, 'media');
  fs.mkdirSync(media, { recursive: true });
  const fonts = new FontRegistry();
  for (const f of fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')))
    bundled(fonts, f);
  const ctx = { out, media, fonts, render };
  const films: ViewerFilm[] = [];
  for (const d of findFilms(roots)) {
    let f;
    if (fs.existsSync(path.join(d, 'film.json'))) f = manifestFilm(d, ctx);
    else if (fs.existsSync(path.join(d, 'storyboard.json')))
      f = await clearframeFilm(d, ctx);
    else f = briefFilm(d, ctx);
    if (f) films.push(f);
  }
  films.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const data = {
    generatedAt: new Date().toISOString(),
    roots: roots.map((r) => path.relative(process.cwd(), r) || '.'),
    films,
  };
  const html = fs
    .readFileSync(path.join(UI, 'index.html'), 'utf8')
    .replace('/*STYLE*/', () =>
      fs.readFileSync(path.join(UI, 'style.css'), 'utf8'),
    )
    .replace('/*APP*/', () => fs.readFileSync(path.join(UI, 'app.js'), 'utf8'))
    .replace('"/*DATA*/"', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  const file = path.join(out, 'index.html');
  fs.writeFileSync(file, html);
  return {
    file,
    data,
    films: films.length,
    versions: films.reduce((n, f) => n + f.versions.length, 0),
    dirs: Object.fromEntries(findFilms(roots).map((d) => [filmId(d), d])),
  };
}

/** One ClearFrame film as the page sees it, rebuilt after a render (no board stills drawn). */
export async function filmData(
  dir: string,
  { out = 'build/viewer' }: { out?: string } = {},
) {
  out = path.resolve(out);
  const media = path.join(out, 'media'),
    fonts = new FontRegistry();
  fs.mkdirSync(media, { recursive: true });
  for (const f of fs.readdirSync(FONT_DIR).filter((f) => f.endsWith('.ttf')))
    bundled(fonts, f);
  return clearframeFilm(dir, { out, media, fonts, render: false });
}
