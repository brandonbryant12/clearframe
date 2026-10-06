// Building blocks: chart templates (rendered previews), palettes and prepared 3D elements.
import fs from 'node:fs';
import path from 'node:path';
import { stillProject } from '../../../film/render.mjs';
import { ROOT, readJSON, hash, rel } from './media.mjs';


export async function chartTemplates(out, media, { render = true } = {}) {
  const kit = path.join(ROOT, 'examples/finance-charts');
  const readme = fs.existsSync(path.join(kit, 'README.md')) ? fs.readFileSync(path.join(kit, 'README.md'), 'utf8') : '';
  const uses = Object.fromEntries([...readme.matchAll(/^\| `([a-z-]+)` \| ([^|]+) \| ([^|]+) \|$/gm)].map(m => [m[1], { pattern: m[2].trim(), use: m[3].trim() }]));
  const templates = [];
  for (const shape of ['landscape', 'vertical']) {
    const sb = readJSON(path.join(kit, `storyboard-${shape}.json`));
    if (!sb) continue;
    const work = path.join(out, 'work', `charts-${shape}`);
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(path.join(work, 'storyboard.json'), JSON.stringify(sb));
    let t = 0;
    for (const b of sb.beats) {
      t += b.duration;
      const key = `chart-${shape}-${b.id}-${hash(JSON.stringify(b))}`, img = path.join(media, `${key}.png`);
      if (render && !fs.existsSync(img)) {
        try { await stillProject(work, { draft: true, at: t - 0.3, out: img }); } catch (e) { console.error(`viewer: ${b.id} (${shape}): ${e.message}`); }
      }
      const kind = Object.keys(b.props ?? {}).find(k => ['stat', 'plot', 'bars', 'distribution', 'multiples'].includes(k));
      const spec = b.props?.[kind] ?? {};
      templates.push({ id: b.id, shape, kind, title: spec.title ?? spec.kicker ?? b.id, pattern: uses[b.id]?.pattern ?? '', use: uses[b.id]?.use ?? '',
        image: fs.existsSync(img) ? rel(out, img) : null, snippet: JSON.stringify(b, null, 2) });
    }
  }
  return templates;
}

export function palettes() {
  const dir = path.join(ROOT, 'library/palettes');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => {
    const p = readJSON(path.join(dir, f), {});
    return { id: f.replace(/\.json$/, ''), order: p.order ?? 999, notes: p.notes ?? '', colors: p.colors ?? {} };
  }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function elements3d(out) {
  const dir = path.join(ROOT, 'examples/sculptures');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'asset.json'))).map(d => {
    const a = readJSON(path.join(dir, d, 'asset.json'), {});
    return { id: d, title: a.title ?? d, use: a.use ?? '', description: a.description ?? '', loop: a.loop === true,
      poster: rel(out, path.join(dir, d, a.poster ?? 'poster.png')), video: rel(out, path.join(dir, d, a.file ?? 'clip.mp4')) };
  });
}

