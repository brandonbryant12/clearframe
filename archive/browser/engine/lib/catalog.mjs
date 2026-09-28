// Block catalog (read from each block's `meta`), icon search, and the gallery project generator.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENGINE_DIR, require, writeJSON } from './util.mjs';

export const BLOCKS_DIR = path.join(ENGINE_DIR, 'runtime', 'blocks');

export async function listBlocks() {
  const files = fs.readdirSync(BLOCKS_DIR).filter((f) => f.endsWith('.js') && !f.startsWith('_')).sort();
  const out = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(BLOCKS_DIR, f)).href);
    out.push({ name: f.replace(/\.js$/, ''), ...(mod.meta ?? {}) });
  }
  return out;
}

/** Search Lucide icon names + tags. */
export function searchIcons(query, limit = 40) {
  const dir = path.dirname(require.resolve('lucide-static/package.json'));
  const tags = JSON.parse(fs.readFileSync(path.join(dir, 'tags.json'), 'utf8'));
  const q = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const [name, t] of Object.entries(tags)) {
    const tagText = (t ?? []).join(' ').toLowerCase();
    let score = 0;
    for (const w of q) score += (name.includes(w) ? 4 : 0) + (name.startsWith(w) ? 2 : 0) + (tagText.includes(w) ? 1.5 : 0);
    if (score <= 0) continue;
    scored.push({ name, score: score - name.length / 60, tags: (t ?? []).slice(0, 6) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Write a project that shows every block with its example props (the visual catalog). */
export async function writeGallery(dir, { format = 'landscape', theme = 'paper', only } = {}) {
  const blocks = (await listBlocks()).filter((b) => !only || only.includes(b.name));
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, 'storyboard.json'), {
    title: `ClearFrame block gallery (${format})`,
    format: { preset: format, fps: 30 },
    theme, music: false, sfx: false, chrome: false, captions: false, transition: 'cut', backdrop: 'dots',
    pacing: { lead: 0.3, tail: 1.2, minBeat: 4 },
    beats: blocks.map((b) => ({ id: b.name, block: b.name, vo: b.example?.vo, props: b.example?.props ?? {}, visual: b.summary })),
    sources: [{ claim: 'All figures in the gallery', source: 'Sample data for demonstration', asOf: 'n/a' }],
  });
  return blocks.length;
}
