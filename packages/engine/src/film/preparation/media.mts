import fs from 'node:fs';
import path from 'node:path';
import { eachElement } from '../canvas.mjs';
import { heldTail } from '../constants.mjs';
import { probeFootage } from '../probes.mjs';
import { sha256 } from '../../scene/engine.mjs';
import { assetSrc } from '../../engine/lib/timing.mjs';
import type { ResolvedStoryboard, Timing } from '../../engine/domain.mjs';
import type { CanvasElement, NativeJob, JobBeat } from '../types.mjs';
import type { AssetRef, Footage } from '../../scene/types.mjs';
export function createStaging(
  root: string,
  sb: ResolvedStoryboard,
  media: string,
) {
  const neededMedia = new Set<string>();
  const hashes: Record<string, string> = {};
  const record = (file: string) => {
    hashes[path.relative(root, file)] = sha256(fs.readFileSync(file));
  };
  record(path.join(root, 'storyboard.json'));
  const stage = (rel: string, where: string) => {
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
      throw new Error(`${where}: media must exist inside the project`);
    record(file);
    const key = `${sha256(fs.readFileSync(file)).slice(0, 16)}${path.extname(file).toLowerCase()}`;
    neededMedia.add(key);
    const out = path.join(media, key);
    if (!fs.existsSync(out)) fs.copyFileSync(file, out);
    return { file, key };
  };
  const assetFile = (ref: AssetRef, kind: string | null, where: string) => {
    if (ref.file) return ref.file;
    const a = sb.assets.find((a) => a.id === ref.asset);
    if (!a) throw new Error(`${where}: unknown asset ${ref.asset}`);
    if (kind && a.kind !== kind)
      throw new Error(
        `${where}: asset ${a.id} is a ${a.kind}, not ${kind === 'clip' ? 'footage' : 'an image'}`,
      );
    const rel = assetSrc(root, a);
    if (!rel)
      throw new Error(
        `${where}: asset ${a.id} is missing; import it or run images/clips.`,
      );
    return rel;
  };

  return { root, sb, media, neededMedia, hashes, record, stage, assetFile };
}
export type MediaStaging = ReturnType<typeof createStaging>;

function stageImages(b: JobBeat, { stage, assetFile }: MediaStaging): void {
  const images: CanvasElement[] = [];
  eachElement(b.props.elements, (el) => {
    if (el.type === 'image') images.push(el);
  });
  if (b.art)
    for (const l of ['under', 'over'] as const)
      eachElement(b.art[l], (el) => {
        if (el.type === 'image') images.push(el);
      });
  for (const el of images) {
    const { key } = stage(assetFile(el, 'image', `${b.id} canvas image`), b.id);
    el.file = key;
    delete el.asset;
  }
  const morphs: CanvasElement[] = [];
  eachElement(b.props.elements, (el) => {
    if (el.morph?.from?.type === 'image') morphs.push(el.morph.from);
  });
  if (b.art)
    for (const l of ['under', 'over'] as const)
      eachElement(b.art[l], (el) => {
        if (el.morph?.from?.type === 'image') morphs.push(el.morph.from);
      });
  for (const from of morphs) {
    const { key } = stage(
      assetFile(from, 'image', `${b.id} morph image`),
      b.id,
    );
    from.file = key;
    delete from.asset;
  }
}

function stagePlate(
  b: JobBeat,
  job: NativeJob,
  { stage, assetFile }: MediaStaging,
  footage: Footage[],
): void {
  if (b.plate) {
    const rel = assetFile(b.plate, null, `${b.id} plate`),
      video = /\.(mp4|mov|webm|m4v)$/i.test(rel);
    const { file, key } = stage(rel, `${b.id} plate`);
    b.plate.file = key;
    b.plate.video = video;
    delete b.plate.asset;
    if (video) {
      const duration = probeFootage(file, `${b.id} plate`, rel);
      // A wipe into the next beat holds this one on screen ahead of its edge.
      const shown = b.frames / job.fps + heldTail(job, job.beats.indexOf(b));
      if (!(duration - (b.plate.offset ?? 0) + 1 / job.fps >= shown))
        throw new Error(
          `${b.id}: plate footage is shorter than the beat${shown > b.frames / job.fps ? ' and the wipe after it' : ''}; trim the beat or use a longer clip; B-roll does not loop.`,
        );
      footage.push({
        beat: b.id,
        index: job.beats.indexOf(b),
        source: rel,
        offset: b.plate.offset ?? 0,
        seconds: shown,
      });
    }
  }
}

function stageBlock(
  b: JobBeat,
  job: NativeJob,
  timing: Timing,
  { root, sb, stage }: MediaStaging,
  footage: Footage[],
): void {
  if (!['image', 'video', 'annotate'].includes(b.block)) return;
  const prop = b.props,
    a = prop.asset && sb.assets.find((a) => a.id === prop.asset);
  if (a && a.kind !== (b.block === 'video' ? 'clip' : 'image'))
    throw new Error(`${b.id}: asset kind does not match the block`);
  const rel = prop.file ?? (a && assetSrc(root, a));
  if (!rel)
    throw new Error(
      `${b.id}: asset is missing; import it or run images/clips.`,
    );
  const { file, key } = stage(rel, b.id);
  prop.file = key;
  if (b.block === 'video') {
    const duration = probeFootage(file, b.id, rel);
    const shown = b.frames / timing.fps + heldTail(job, job.beats.indexOf(b));
    if (
      !Number.isFinite(duration) ||
      duration - (prop.offset ?? 0) + 1 / timing.fps < shown
    )
      throw new Error(
        `${b.id}: clip is shorter than the authored beat${shown > b.frames / timing.fps ? ' and the wipe after it' : ''}; trim the beat or provide a longer clip.`,
      );
    footage.push({
      beat: b.id,
      index: job.beats.indexOf(b),
      source: rel,
      offset: prop.offset ?? 0,
      seconds: shown,
    });
  }
}

export function stageJobMedia(
  staging: MediaStaging,
  job: NativeJob,
  timing: Timing,
): Footage[] {
  const footage: Footage[] = [];
  for (const b of job.beats) {
    stageImages(b, staging);
    stagePlate(b, job, staging, footage);
  }
  for (const b of job.beats) stageBlock(b, job, timing, staging, footage);
  return footage;
}
