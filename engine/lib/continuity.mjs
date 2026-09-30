import fs from 'node:fs';
import path from 'node:path';
import { palette } from '../../fframes/catalog.mjs';
import { hashOf } from './util.mjs';
import { audioHash } from './word-timing.mjs';
import { MODEL } from '../../skills/gemini-omni/scripts/omni.mjs';

export function clipSpec(root, sb, a, { allowMissing = false } = {}) {
  const style = sb.continuity ?? {},
    colors = palette(sb.theme ?? 'paper');
  const refs = [...(a.refs ?? style.refs ?? [])];
  if (a.image) refs.unshift(a.image);
  else if (a.from) refs.unshift(`assets/img/${a.from}.jpg`);
  const references = refs.map(file => {
    const full = path.resolve(root, file);
    if (!full.startsWith(path.resolve(root) + path.sep) || (!allowMissing && !fs.existsSync(full)))
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
    references.length === 2
      ? 'Use the first reference as the opening composition and the second as the closing composition.'
      : references.length
        ? 'Match the reference composition, subject, palette and lighting.'
        : '',
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
  return { ...spec, hash: hashOf(spec), refs: references.map(r => path.resolve(root, r.file)) };
}
