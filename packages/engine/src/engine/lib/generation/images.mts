import type { Asset, ResolvedStoryboard } from '../../domain.mjs';

import type { GenerateOptions } from '../generate-model.mjs';
import {
  money,
  guardBudget,
  assetMeta,
  nonempty,
  frameAspect,
} from '../generate-model.mjs';

import fs from 'node:fs';

import { CHROMA, keyOut } from '../plates.mjs';
import path from 'node:path';

import { loadStoryboard, paths } from '../project.mjs';

import { audioHash } from '../word-timing.mjs';
import { hashOf, log, writeJSON } from '../util.mjs';

import * as image from '../../../skills/gemini-image/scripts/image.mjs';

import { palette } from '../../../film/catalog.mjs';

function referenceFiles(root: string, img: string, a: Asset) {
  return (a.refs ?? []).map((ref) => {
    const full = path.resolve(root, ref);
    if (!full.startsWith(path.resolve(root) + path.sep))
      throw new Error(`Image reference must be inside the project: ${ref}`);
    return fs.existsSync(full) ? full : path.join(img, `${ref}.jpg`);
  });
}

/** What an image's cache depends on: how it is drawn, not how it is staged (bounds, ground). */
export function imageHash(root: string, sb: ResolvedStoryboard, a: Asset) {
  const { bounds: _bounds, ground: _ground, ...drawn } = a;
  return hashOf({
    ...drawn,
    model: a.model ?? image.MODEL,
    aspect: a.aspect ?? frameAspect(sb.format),
    prompt: imagePrompt(sb, drawn),
    ...(a.refs?.length
      ? {
          referenceBytes: referenceFiles(root, paths(root).img, a).map(
            (file) => (fs.existsSync(file) ? audioHash(file) : null),
          ),
        }
      : {}),
  });
}

/**
 * The prompt actually sent for a generated still: the author's subject, then the film's palette
 * and continuity, then composition hints from how the storyboard uses the image (a split plate
 * needs its subject away from the seam; a full plate needs calm space where text sits).
 * `raw: true` sends the author's prompt unchanged.
 */
export function imagePrompt(sb: ResolvedStoryboard, a: Asset): string {
  if (typeof a.prompt !== 'string')
    throw new Error(`Image ${a.id} requires a prompt`);
  if (a.raw) return a.prompt;
  const style = sb.continuity ?? {};
  const uses = sb.beats.filter(
    (b) => b.plate?.asset === a.id || b.props?.asset === a.id,
  );
  const hints = [
    ...new Set(
      uses
        .map((b) => {
          const side = b.plate?.side ?? (b.plate ? 'full' : null);
          if (side === 'full')
            return `Composition: a calm, uncluttered area on the ${b.props?.align === 'center' ? 'centre' : 'left half'} where large text will sit; the subject toward the ${b.props?.align === 'center' ? 'edges' : 'right third'}.`;
          if (side === 'left' || side === 'top')
            return 'Composition: the subject centred in the frame, nothing important near the right edge (it meets a text panel).';
          if (side === 'right' || side === 'bottom')
            return 'Composition: the subject centred, nothing important near the left edge (it meets a text panel).';
          return null;
        })
        .filter(Boolean),
    ),
  ];
  const treated = uses.some((b) =>
    ['duotone', 'tint', 'mono'].includes(b.plate?.treatment ?? ''),
  );
  return [
    a.prompt,
    imagePalettePrompt(sb, a, treated),
    `Treatment: ${style.treatment ?? 'editorial, restrained, generous negative space'}. Lighting: ${style.lighting ?? 'soft, diffuse'}.`,
    ...hints,
    'No text, letters, numbers, logos, watermarks, charts or UI anywhere in the image.',
    ...(a.cutout ? [CHROMA] : []),
  ].join('\n');
}

export async function images(
  root: string,
  { only, force = false, budget }: GenerateOptions = {},
) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const list = sb.assets.filter(
    (a) => a.kind === 'image' && !a.file && (!only || only.includes(a.id)),
  );
  const specHash = (a: Asset) => imageHash(root, sb, a);
  const todo = list.filter(
    (a) =>
      force ||
      assetMeta(P.img, a.id)?.hash !== specHash(a) ||
      !nonempty(path.join(P.img, `${a.id}.${a.cutout ? 'png' : 'jpg'}`)),
  );
  if (!todo.length) {
    log.ok('Images are up to date.');
    return;
  }
  const cost = todo.reduce(
    (s, a) => s + image.estimateCost({ model: a.model, size: a.size ?? '2K' }),
    0,
  );
  log.step(`Gemini image: ${todo.length} image(s), ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  fs.mkdirSync(P.img, { recursive: true });
  for (const a of todo) {
    const refs = referenceFiles(root, P.img, a);
    const hash = specHash(a);
    const aspect = a.aspect ?? frameAspect(sb.format);
    const prompt = imagePrompt(sb, a);
    const r = await image.generateImage({
      prompt,
      model: a.model ?? image.MODEL,
      aspect,
      size: a.size ?? '2K',
      refs,
    });
    if (a.cutout) {
      // Keyed to transparency so the layer can stand in depth over the others.
      const raw = path.join(P.img, `${a.id}.green.jpg`);
      fs.writeFileSync(raw, r.data);
      await keyOut(raw, path.join(P.img, `${a.id}.png`));
      fs.rmSync(path.join(P.img, `${a.id}.jpg`), { force: true });
    } else fs.writeFileSync(path.join(P.img, `${a.id}.jpg`), r.data);
    writeJSON(path.join(P.img, `${a.id}.json`), {
      hash,
      model: a.model ?? image.MODEL,
      prompt,
      note: r.text,
      createdAt: new Date().toISOString(),
    });
    log.ok(`${a.id} → assets/img/${a.id}.${a.cutout ? 'png (keyed)' : 'jpg'}`);
  }
}

export function imagePalettePrompt(
  sb: ResolvedStoryboard,
  asset: Asset,
  treated: boolean,
): string {
  const colors = palette(sb.theme ?? 'paper');
  if (treated)
    return 'Strong tonal contrast and clear shapes; it will be recoloured into two tones, so readable light and shadow matter more than colour.';
  if (asset.cutout)
    return `Colour palette for the subject: deep tones near ${colors.ink}, one accent close to ${colors.accent}.`;
  return `Colour palette: background ${colors.bg}, deep tones near ${colors.ink}, one accent close to ${colors.accent}.`;
}
