// One source of truth for the generated bed, including legacy projects without a file field.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJSON } from './util.mjs';

const extensions = ['wav', 'mp3', 'ogg'];
export function findMusicBed(root, meta = readJSON(path.join(root, 'assets/music/bed.json'), null)) {
  const candidates = meta?.file ? [meta.file] : extensions.map(ext => `assets/music/bed.${ext}`);
  return (
    candidates.find(file => {
      try {
        const st = fs.statSync(path.join(root, file));
        return st.isFile() && st.size > 0;
      } catch {
        return false;
      }
    }) ?? null
  );
}

/** Stage complete bytes before replacing a bed; delete alternate formats only after success. */
export function writeMusicBed(root, data, ext, meta) {
  if (!extensions.includes(ext) || !data.length) throw new Error('Cannot save an empty or unsupported music bed');
  const file = `assets/music/bed.${ext}`;
  const dest = path.join(root, file),
    metaFile = path.join(root, 'assets/music/bed.json');
  const token = randomUUID(),
    tmp = `${dest}.${token}.tmp`,
    metaTmp = `${metaFile}.${token}.tmp`;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(tmp, data);
    fs.writeFileSync(metaTmp, JSON.stringify({ ...meta, file }, null, 2) + '\n');
    fs.renameSync(tmp, dest);
    fs.renameSync(metaTmp, metaFile);
    for (const other of extensions)
      if (other !== ext) fs.rmSync(path.join(root, `assets/music/bed.${other}`), { force: true });
  } finally {
    fs.rmSync(tmp, { force: true });
    fs.rmSync(metaTmp, { force: true });
  }
  return file;
}
