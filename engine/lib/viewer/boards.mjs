// Storyboard frames drawn straight from a storyboard, so a film has pictures before it has a video.
// Placeholder scenes render as their labelled slates (the rough profile).
import fs from 'node:fs';
import path from 'node:path';
import { stillProject } from '../../../film/render.mjs';
import { hash, rel, readJSON } from './media.mjs';
import { describeBeat } from './clearframe.mjs';

const BRIEFS = ['brief.md', 'BRIEF.md', 'DIRECTION.md'];
export const briefOf = dir => { const f = BRIEFS.map(b => path.join(dir, b)).find(f => fs.existsSync(f)); return f ? fs.readFileSync(f, 'utf8').slice(0, 20000) : null; };
export const hasBrief = dir => BRIEFS.slice(0, 2).some(b => fs.existsSync(path.join(dir, b)));

export async function boards(dir, sb, { out, media, render = true }) {
  const rough = (sb.beats ?? []).some(b => b.placeholder);
  const look = hash(JSON.stringify([sb.theme, sb.format, sb.type]));
  let t = 0;
  const list = [];
  for (const [i, b] of (sb.beats ?? []).entries()) {
    const seconds = b.duration ?? 4;
    t += seconds;
    const img = path.join(media, `board-${hash(dir)}-${b.id}-${hash(JSON.stringify(b) + look)}.png`);
    if (render && !fs.existsSync(img)) {
      try { await stillProject(dir, { draft: true, rough, at: t - 0.3, out: img }); } catch (e) { console.error(`viewer: board ${path.basename(dir)}/${b.id}: ${e.message.split('\n')[0]}`); }
    }
    list.push({ number: i + 1, id: b.id, seconds, ...describeBeat(b), narration: b.vo ?? null, placeholder: b.placeholder ?? null, image: fs.existsSync(img) ? rel(out, img) : null });
  }
  return list;
}
