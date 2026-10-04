// Assemble the page: films, library and fonts into one self-contained HTML file.
import fs from 'node:fs';
import path from 'node:path';
import { UI, FONT_DIR, slug } from './media.mjs';
import { FontRegistry } from './files.mjs';
import { clearframeFilm, bundled } from './clearframe.mjs';
import { manifestFilm, findFilms } from './manifest.mjs';
import { chartTemplates, palettes, elements3d } from './library.mjs';

export async function buildViewer({ root = ['examples', 'real-examples'], out = 'build/viewer', render = true } = {}) {
  const roots = (Array.isArray(root) ? root : [root]).map(r => path.resolve(r));
  out = path.resolve(out);
  const media = path.join(out, 'media');
  fs.mkdirSync(media, { recursive: true });
  const fonts = new FontRegistry();
  for (const f of fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf'))) bundled(fonts, f);
  const ctx = { out, media, fonts };
  const films = findFilms(roots).map(d => fs.existsSync(path.join(d, 'film.json')) ? manifestFilm(d, ctx) : clearframeFilm(d, ctx)).filter(Boolean)
    .sort((a, b) => Date.parse(b.versions.at(-1).createdAt) - Date.parse(a.versions.at(-1).createdAt));
  const data = { generatedAt: new Date().toISOString(), roots: roots.map(r => path.relative(process.cwd(), r) || '.'), films,
    library: { charts: await chartTemplates(out, media, { render }), palettes: palettes(), elements: elements3d(out), fonts: fonts.list(out) } };
  fs.writeFileSync(path.join(out, 'fonts.css'), fonts.css());
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8')
    .replace('/*STYLE*/', () => fs.readFileSync(path.join(UI, 'style.css'), 'utf8'))
    .replace('/*APP*/', () => `(() => {\n${fs.readdirSync(path.join(UI, 'js')).filter(f => f.endsWith('.js')).sort().map(f => fs.readFileSync(path.join(UI, 'js', f), 'utf8')).join('\n')}\n})();`)
    .replace('"/*DATA*/"', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  const file = path.join(out, 'index.html');
  fs.writeFileSync(file, html);
  return { file, films: films.length, versions: films.reduce((n, f) => n + f.versions.length, 0), charts: data.library.charts.length, fonts: data.library.fonts.length,
    dirs: Object.fromEntries(findFilms(roots).map(d => [slug(path.relative(process.cwd(), d)), d])) };
}

