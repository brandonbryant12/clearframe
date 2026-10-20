import fs from 'node:fs';
import path from 'node:path';
import { usesLevels } from '../canvas.mjs';
import { FILM as ROOT, sha256 } from '../../scene/engine.mjs';
import { voiceLevels } from '../../engine/lib/levels.mjs';
import { SFX, sfxRecipe, cueFile, cueIdentity } from '../../engine/lib/sfx.mjs';
import { soundDesign } from '../sound.mjs';
import type { MediaStaging } from './media.mjs';
import type { Timing, ResolvedStoryboard } from '../../engine/domain.mjs';
import type { JobResult } from '../types.mjs';
export function recordAudioInputs(
  timing: Timing,
  { root, record }: MediaStaging,
): void {
  for (const b of timing.beats)
    if (b.vo?.src) {
      record(path.join(root, b.vo.src));
      const m = path.join(root, 'assets/vo', `${b.id}.json`);
      if (fs.existsSync(m)) record(m);
    }
  if (timing.music?.src) record(path.join(root, timing.music.src));
}
export function attachVoiceLevels(
  timing: Timing,
  result: JobResult,
  root: string,
): void {
  // Voice levels for speaker tags, meters and level loops, from the exact recordings the mix uses.
  for (const [i, jb] of result.job.beats.entries()) {
    const tb = timing.beats[i];
    if (!tb?.vo?.src) continue;
    if (
      !(
        jb.speaker ||
        usesLevels(jb.props.elements) ||
        usesLevels(jb.art?.under) ||
        usesLevels(jb.art?.over)
      )
    )
      continue;
    jb.levels = voiceLevels(path.join(root, tb.vo.src), {
      fps: result.job.fps,
      frames: jb.frames,
      offset: tb.vo.start - jb.start_frame / result.job.fps,
    });
  }
}
export function recordSoundInputs(
  timing: Timing,
  sb: ResolvedStoryboard,
  result: JobResult,
  { root, record, hashes }: MediaStaging,
) {
  // Every sound the mix plays is an input: a cue file edited or replaced makes a different film
  // (a new input id, a new revision, a fresh preview mix). A built-in cue is named by its recipe.
  const sounds: Record<string, string> = {};
  const named = [
    ...timing.beats.flatMap((b) => (b.sfx ?? []).map((s) => s.src)),
    ...soundDesign(result.job, sb.sfx).map((c) => c.name),
  ];
  for (const name of new Set(named.filter(Boolean))) {
    if (sfxRecipe(name)) {
      sounds[name] = `builtin:${cueIdentity(name)}`;
      continue;
    }
    const file = cueFile(root, name);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      result.warnings.push(
        `sound "${name}" is not a built-in cue or a file inside the project: the mix leaves it out (built-ins: ${Object.keys(SFX).join(', ')})`,
      );
      continue;
    }
    record(file);
    sounds[name] = hashes[path.relative(root, file)];
  }

  return sounds;
}
export function stageFonts({ neededMedia, media }: MediaStaging) {
  for (const f of fs
    .readdirSync(path.join(ROOT, 'assets/fonts'))
    .filter((f) => /\.ttf$/i.test(f))) {
    neededMedia.add(f);
    fs.copyFileSync(path.join(ROOT, 'assets/fonts', f), path.join(media, f));
  }
  for (const f of fs.readdirSync(media))
    if (!neededMedia.has(f) && fs.statSync(path.join(media, f)).isFile())
      fs.unlinkSync(path.join(media, f));

  return Object.fromEntries(
    fs
      .readdirSync(path.join(ROOT, 'assets/fonts'))
      .filter((f) => /\.ttf$/i.test(f))
      .map((f) => [
        f,
        sha256(fs.readFileSync(path.join(ROOT, 'assets/fonts', f))),
      ]),
  );
}
