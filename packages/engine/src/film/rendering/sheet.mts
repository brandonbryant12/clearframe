// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { prepareProject, nativeCommand, unchanged } from '../prepare.mjs';

import { ffmpeg, writeJSON } from '../../engine/lib/util.mjs';
import { phase } from '../../engine/lib/runlog.mjs';

import { withGuides } from './stills.mjs';
import type { SheetOptions } from './contracts.mjs';
import type { PreparedContext } from '../preparation/contracts.mjs';
export async function sheetProject(
  root: string,
  {
    draft = false,
    rough = false,
    per,
    columns,
    thumb,
    out,
    grid = false,
  }: SheetOptions = {},
) {
  let ctx = await phase('prepare', () =>
    prepareProject(root, { draft, rough }),
  );
  if (grid) ctx = withGuides(ctx);
  const size = sheetSize(ctx.timing, { per, columns, thumb });
  const times = ctx.timing.beats.flatMap((b) =>
    samplePositions(size.per).map((p) =>
      Math.min(b.end - 1 / ctx.timing.fps, b.start + b.dur * p),
    ),
  );
  const shots = path.join(ctx.dir, `sheet-${crypto.randomUUID()}`);
  fs.mkdirSync(shots);
  const file = path.resolve(out ?? path.join(root, 'build/sheet.png'));
  try {
    await phase(
      'native-frames',
      () =>
        nativeCommand(ctx, 'frame', [
          times.map((t) => `${t.toFixed(4)}s`).join(','),
          '-o',
          shots,
        ]),
      {
        frames: times.length,
      },
    );
    const pngs = fs
      .readdirSync(shots)
      .filter((f) => f.endsWith('.png'))
      .sort();
    if (pngs.length !== times.length)
      throw new Error(
        `Expected ${times.length} frame PNGs; got ${pngs.length}`,
      );
    // Upstream names contain frame numbers; numeric sort preserves beat order.
    pngs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    pngs.forEach((f, i) =>
      fs.copyFileSync(
        path.join(shots, f),
        path.join(shots, `tile-${String(i).padStart(4, '0')}.png`),
      ),
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await ffmpeg([
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(shots, 'tile-%04d.png'),
      '-vf',
      `scale=${size.thumb}:-1,tile=${size.columns}x${Math.ceil(times.length / size.columns)}:padding=8:margin=8:color=0x161b22`,
      '-frames:v',
      '1',
      '-threads',
      '1',
      file,
    ]);
    unchanged(ctx);
    writeJSON(`${file}.json`, {
      inputId: ctx.manifest.inputId,
      times,
      beats: ctx.job.beats.map((b) => b.id),
    });
    return file;
  } finally {
    fs.rmSync(shots, { recursive: true, force: true });
    ctx.cleanup?.();
  }
}

function sheetSize(timing: PreparedContext['timing'], options: SheetOptions) {
  const beats = timing.beats.length,
    aspect = timing.height / timing.width;
  let per = options.per ?? 3,
    columns = options.columns ?? options.per ?? 3,
    thumb = options.thumb ?? 400;
  const tall = (t: number) =>
    Math.ceil((beats * per) / columns) * (t * aspect + 8);
  if (options.per == null && options.columns == null) {
    if (tall(thumb) > 4000) columns = 6;
    if (tall(thumb) > 4000) {
      per = 1;
      columns = aspect > 1 ? 8 : 6;
    }
    if (tall(thumb) > 4000)
      thumb = Math.max(160, Math.floor((thumb * 4000) / tall(thumb)));
  }
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 8 ||
    !Number.isInteger(thumb) ||
    thumb < 100 ||
    thumb > 1920
  )
    throw new Error('Invalid sheet columns or thumb size');
  if (!Number.isInteger(per) || per < 1 || per > 3)
    throw new Error('sheet --per must be 1–3');
  return { per, columns, thumb };
}
function samplePositions(per: number): number[] {
  if (per === 1) return [0.65];
  return per === 2 ? [0.3, 0.85] : [0.15, 0.55, 0.9];
}
