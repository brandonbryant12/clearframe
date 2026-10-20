import type { Asset, ResolvedStoryboard } from '../domain.mjs';
export interface FootageUse {
  beat: string;
  index: number;
  source: string;
  offset: number;
  seconds: number;
  have?: number | null;
  generated?: boolean;
}
import fs from 'node:fs';
import path from 'node:path';
import { palette } from '../../film/catalog.mjs';
import { hashOf } from './util.mjs';
import { audioHash } from './word-timing.mjs';
import { MODEL } from '../../skills/gemini-omni/scripts/omni.mjs';

export function clipSpec(
  root: string,
  sb: ResolvedStoryboard,
  a: Asset,
  { allowMissing = false } = {},
) {
  const style = sb.continuity ?? {},
    colors = palette(sb.theme ?? 'paper');
  const refs = [...(a.refs ?? style.refs ?? [])];
  if (a.image) refs.unshift(a.image);
  else if (a.from) refs.unshift(`assets/img/${a.from}.jpg`);
  const references = refs.map((file) => {
    const full = path.resolve(root, file);
    if (
      !full.startsWith(path.resolve(root) + path.sep) ||
      (!allowMissing && !fs.existsSync(full))
    )
      throw new Error(`Missing project continuity reference: ${file}`);
    return { file, sha256: fs.existsSync(full) ? audioHash(full) : null };
  });
  const prompt = [
    a.prompt,
    `One continuous shot, approximately ${a.seconds ?? 4} seconds.`,
    `Match this film palette: background ${colors.bg}, foreground ${colors.ink}, accent ${colors.accent}.`,
    `Treatment: ${style.treatment ?? 'restrained editorial imagery with generous negative space'}.`,
    `Lighting: ${style.lighting ?? 'soft diffuse'}. Camera: ${style.camera ?? 'locked, no cuts'}. Movement: ${style.motion ?? 'slow left-to-right drift'}.`,
    style.motif ? `Carry this recurring motif: ${style.motif}.` : '',
    referencePrompt(references.length),
    'Keep the central subject within the middle sixty percent of the frame. Leave room for native titles. No written words, numbers, charts, logos, subtitles, or talking faces. The film uses its own continuous narration and music; avoid an audio-dependent visual.',
  ]
    .filter(Boolean)
    .join('\n');
  const spec = {
    model: a.model ?? MODEL,
    prompt,
    aspect: a.aspect ?? (sb.format.width >= sb.format.height ? '16:9' : '9:16'),
    resolution: a.resolution ?? '720p',
    seconds: a.seconds ?? 4,
    previousInteractionId: a.previousInteractionId,
    references,
    ...(a.seed != null ? { seed: a.seed } : {}),
  };
  if (!Number.isFinite(spec.seconds) || spec.seconds <= 0 || spec.seconds > 10)
    throw new Error('Generated inserts must request 0–10 seconds');
  return {
    ...spec,
    hash: hashOf(spec),
    refs: references.map((r) => path.resolve(root, r.file)),
  };
}

/**
 * B-roll coverage, before anything is paid for or rendered. Each use of footage needs
 * `offset + beat seconds` of source; one generated take holds at most `maxTake` seconds; and
 * two uses that show the same source seconds again are a loop by another name — an error on
 * adjacent beats, a warning elsewhere (a deliberate callback). `uses` are
 * {beat, index, source, offset, seconds, have}, `have` being the source length known so far.
 */
export function footageProblems(
  uses: readonly FootageUse[],
  { maxTake = 10 } = {},
) {
  const errors: string[] = [],
    warnings: string[] = [];
  for (const u of uses) {
    const need = u.offset + u.seconds;
    if (need > maxTake + 1e-3 && u.generated)
      errors.push(
        `${u.beat}: ${need.toFixed(1)} s of ${u.source} is needed but one generated take is at most ${maxTake} s; shorten the beat, or cut it into different shots.`,
      );
    else if (u.have != null && u.have + 1e-3 < need)
      errors.push(
        `${u.beat}: ${u.source} covers ${u.have.toFixed(1)} s but the beat needs ${need.toFixed(1)} s from offset ${u.offset} s; ask for a longer take (seconds), shorten the beat, or add a different shot. B-roll never loops or freezes to fill time.`,
      );
  }
  repeatedFootage(uses, errors, warnings);
  return { errors, warnings };
}

function referencePrompt(count: number): string {
  if (count === 2)
    return 'Use the first reference as the opening composition and the second as the closing composition.';
  return count
    ? 'Match the reference composition, subject, palette and lighting.'
    : '';
}
function repeatedFootage(
  uses: readonly FootageUse[],
  errors: string[],
  warnings: string[],
): void {
  for (let i = 0; i < uses.length; i++)
    for (let j = i + 1; j < uses.length; j++) {
      const [a, b] = [uses[i], uses[j]];
      if (a.source !== b.source) continue;
      const shared =
        Math.min(a.offset + a.seconds, b.offset + b.seconds) -
        Math.max(a.offset, b.offset);
      if (shared <= 0.1) continue;
      const message = `${b.beat} repeats ${shared.toFixed(1)} s of ${a.source} already shown in ${a.beat}; use a different source range (offset) or a different shot.`;
      (Math.abs(a.index - b.index) === 1 ? errors : warnings).push(message);
    }
}
