// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildScene } from '../../scene/engine.mjs';

import { prepareProject, nativeCommand, unchanged } from '../prepare.mjs';

import { mux } from '../../engine/lib/audio.mjs';
import { captionCues, toVTT } from '../../engine/lib/timing.mjs';
import { ffmpeg, writeJSON } from '../../engine/lib/util.mjs';
import { phase, record } from '../../engine/lib/runlog.mjs';
import { sha256File } from '../../engine/lib/store.mjs';

import { validateVideo } from './validation.mjs';
import { packetTimeline } from './video.mjs';
import { fullMix, loudness } from './audio.mjs';
import { frameRange } from './range.mjs';
import { verifyFrames } from './verify.mjs';
import { ENCODERS, unvalidated } from './provenance.mjs';
import { readNativeReport } from './schemas.mjs';
import type { PreviewOptions } from './contracts.mjs';

/**
 * Render frames [a, b) of the full prepared timeline: every beat keeps its place, its
 * neighbours, its world state and its transitions (nothing is cut out of the job). Audio is
 * the matching samples of the full mix. The first and last frames are checked against frames
 * the renderer draws directly at those film positions, so the preview's clock is the film's.
 */
export async function renderRange(
  root: string,
  {
    from,
    to,
    beats,
    handles = 2,
    rough = false,
    out,
    verify = true,
    name,
    ctx: given,
  }: PreviewOptions = {},
) {
  const ctx =
    given ??
    (await phase('prepare', () =>
      prepareProject(root, { draft: true, rough }),
    ));
  const { a, b, covered } = frameRange(ctx.job, { from, to, beats, handles });
  const fps = ctx.job.fps,
    frames = b - a;
  const dir = path.join(root, 'review', 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const base = name ?? `working-${a}-${b}-${ctx.manifest.inputId.slice(0, 8)}`;
  if (!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(base))
    throw new Error(`Invalid preview name ${base}`);
  const output = path.resolve(out ?? path.join(dir, `${base}.mp4`));
  const token = crypto.randomUUID(),
    raw = path.join(ctx.dir, `${token}-range-raw.mp4`),
    nativeReport = path.join(ctx.dir, `${token}-range-native-report.json`),
    silent = path.join(ctx.dir, `${token}-range-video.mp4`),
    cut = path.join(ctx.dir, `${token}-range.wav`),
    finished = path.join(ctx.dir, `${token}-range-final.mp4`),
    shots = path.join(ctx.dir, `${token}-range-frames`);
  const start = performance.now();
  try {
    await phase('native-build', () => buildScene());
    await phase(
      'native-render',
      () =>
        nativeCommand(ctx, 'render', [
          `${a}..${b}`,
          '--draft',
          '--scale',
          '1',
          '-o',
          raw,
          '--report',
          nativeReport,
        ]),
      { frames },
    );
    const native = readNativeReport(nativeReport);
    await phase('timeline', () => packetTimeline(raw, silent));
    await phase('validate', () =>
      validateVideo(silent, { ...ctx.job, frames }),
    );
    const full = await phase('mix', () => fullMix(root, ctx));
    let audio = null;
    if (full) {
      const rate = 48000,
        s0 = (a * rate) / fps,
        s1 = (b * rate) / fps;
      await phase('audio-cut', () =>
        ffmpeg([
          '-y',
          '-i',
          full,
          '-af',
          `atrim=start_sample=${s0}:end_sample=${s1},asetpts=PTS-STARTPTS`,
          '-c:a',
          'pcm_s16le',
          cut,
        ]),
      );
      audio = {
        from: 'the full film mix',
        samples: [s0, s1],
        rate,
        film: loudness(full),
        stretch: loudness(cut),
      };
    }
    await phase('mux', () => mux(silent, audio ? cut : null, finished));
    const probe = validateVideo(finished, { ...ctx.job, frames });
    const check = verify
      ? await verifyFrames(ctx, a, b, finished, shots)
      : null;
    unchanged(ctx);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.renameSync(finished, output);
    // Speech for the page's player, on the preview's own clock.
    const cues = captionCues(ctx.timing)
      .filter((c) => c.end > a / fps && c.start < b / fps)
      .map((c) => ({
        ...c,
        start: Math.max(0, c.start - a / fps),
        end: Math.min(frames / fps, c.end - a / fps),
      }));
    fs.writeFileSync(output.replace(/\.mp4$/, '.vtt'), toVTT(cues));
    const report = {
      kind: 'range-preview',
      profile: ctx.manifest.profile,
      inputId: ctx.manifest.inputId,
      rendererSourceHash: ctx.manifest.rendererSourceHash,
      range: { frames: [a, b], seconds: [a / fps, b / fps], fps, handles },
      beats: covered,
      width: ctx.job.width,
      height: ctx.job.height,
      fps,
      frames,
      encoder: ENCODERS.draft,
      native,
      audio,
      verified: check,
      captions: ctx.job.captions
        ? 'burned in by the renderer, as in the film'
        : 'none in the picture; speech cues in the .vtt beside the preview',
      output,
      outputSha256: sha256File(output),
      seconds: (performance.now() - start) / 1000,
      notValidated: unvalidated(ctx, null),
      colorSpace: probe.video.color_space ?? null,
    };
    writeJSON(`${output}.json`, report);
    record({ preview: path.relative(root, output), frames });
    return report;
  } finally {
    for (const f of [raw, silent, cut, finished, nativeReport])
      fs.rmSync(f, { force: true });
    fs.rmSync(shots, { recursive: true, force: true });
  }
}
