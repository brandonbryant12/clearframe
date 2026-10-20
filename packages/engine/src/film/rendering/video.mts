// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildScene, backend } from '../../scene/engine.mjs';

import { prepareProject, nativeCommand, unchanged } from '../prepare.mjs';
import { renderGeometry } from '../render-geometry.mjs';
import { soundDesign } from '../sound.mjs';
import { mix, mux, encodeAudio } from '../../engine/lib/audio.mjs';

import { ffmpeg, writeJSON, log } from '../../engine/lib/util.mjs';
import { phase, record } from '../../engine/lib/runlog.mjs';
import { sha256File } from '../../engine/lib/store.mjs';
import { snapshot, attachVideo } from '../../engine/lib/revisions.mjs';

import { validateVideo } from './validation.mjs';
import { ENCODERS, finishingSources, unvalidated } from './provenance.mjs';
import { readNativeReport } from './schemas.mjs';
import type { RenderOptions, RenderReport } from './contracts.mjs';

/** Rebuild the MP4 timeline from the packets themselves (an edit list that ends a frame early
 * makes players drop the final frame); frames are copied bit-for-bit. */
export const packetTimeline = (raw: string, silent: string) =>
  ffmpeg([
    '-y',
    '-ignore_editlist',
    '1',
    '-i',
    raw,
    '-map',
    '0:v:0',
    '-c:v',
    'copy',
    '-bsf:v',
    'setts=pts=PTS-STARTPTS:dts=DTS-STARTPTS',
    '-an',
    silent,
  ]);

export async function renderProject(
  root: string,
  {
    draft = false,
    rough = false,
    out,
    noAudio = false,
    force = false,
    scale = 1,
    check,
    revision = true,
    label,
  }: RenderOptions = {},
) {
  renderGeometry(
    { width: 1920, height: 1080 },
    { draft: draft || rough, scale },
  );
  const ctx = await phase('prepare', () =>
    prepareProject(root, { draft, rough }),
  );
  const geometry = renderGeometry(ctx.job, { draft: draft || rough, scale });
  const expected = { ...ctx.job, ...geometry };
  const output = path.resolve(out ?? path.join(root, 'build/video.mp4'));
  if (out && fs.existsSync(output) && !force)
    throw new Error(
      `Output exists: ${output}; choose a new file or use --force.`,
    );
  const token = crypto.randomUUID(),
    raw = path.join(ctx.dir, `${token}-raw.mp4`),
    nativeReport = path.join(ctx.dir, `${token}-native-report.json`),
    silent = path.join(ctx.dir, `${token}-video.mp4`),
    audio = path.join(ctx.dir, `${token}-mix.wav`),
    encoded = path.join(ctx.dir, `${token}-mix.m4a`),
    finished = path.join(ctx.dir, `${token}-final.mp4`);
  const start = performance.now();
  const fast = draft || rough;
  let sound: Promise<string | null> = Promise.resolve(null);
  try {
    await phase('native-build', () => buildScene());
    const soundCues = soundDesign(ctx.job, ctx.sb.sfx);
    // The cue sheet, for review: what plays where (bench waveforms mark these).
    writeJSON(path.join(root, 'build/cues.json'), soundCues);
    // The sound depends on the timing, never on the picture: it is mixed and encoded while the
    // renderer draws (a third of a draft's time went to the two after it), and muxed by copy.
    sound = noAudio
      ? Promise.resolve(null)
      : phase('mix', () =>
          mix(root, ctx.timing, audio, ctx.sb.mix, soundCues),
        ).then((track) =>
          track
            ? phase('audio-encode', () => encodeAudio(track, encoded))
            : null,
        );
    sound.catch(() => {});
    // Scale only the output raster; layout, frame rate, speech and source media clocks stay authored.
    await phase(
      'native-render',
      () =>
        nativeCommand(ctx, 'render', [
          ...(fast ? ['--draft', '--scale', String(scale)] : []),
          '-o',
          raw,
          '--report',
          nativeReport,
        ]),
      {
        frames: ctx.job.frames,
      },
    );
    const native = readNativeReport(nativeReport);
    await phase('timeline', () => packetTimeline(raw, silent));
    const track = await sound;
    await phase('mux', () => mux(silent, track, finished));
    // Decode/count the complete deliverable once, after muxing and before publication.
    const probe = await phase('validate-output', () =>
      validateVideo(finished, expected),
    );
    unchanged(ctx);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.renameSync(finished, output);
    const report: RenderReport = {
      ...ctx.manifest,
      encoder: fast ? ENCODERS.draft : ENCODERS.final,
      width: geometry.width,
      height: geometry.height,
      authoredWidth: ctx.job.width,
      authoredHeight: ctx.job.height,
      scale,
      fps: ctx.job.fps,
      frames: ctx.job.frames,
      seconds: (performance.now() - start) / 1000,
      backend: native.backend ?? backend(),
      native,
      planSha256: ctx.manifest.planSha256,
      audio: !!probe.audio,
      colorSpace: probe.video.color_space ?? null,
      colorTransfer: probe.video.color_transfer ?? null,
      colorPrimaries: probe.video.color_primaries ?? null,
      colorRange: probe.video.color_range ?? null,
      // The native source hash excludes the JavaScript finishing step: the mix, its cues and where they land.
      finishingSourceHashes: finishingSources(),
      outputSha256: await phase('hash', () => sha256File(output)),
      voiceProviders: [
        ...new Set(
          ctx.timing.beats
            .map((b) => b.vo?.provider)
            .filter(
              (provider): provider is string => typeof provider === 'string',
            ),
        ),
      ],
      ...(fast ? { notValidated: unvalidated(ctx, check) } : {}),
    };
    writeJSON(`${output}.json`, report);
    log.ok(`Video → ${output}`);
    record({ frames: ctx.job.frames, profile: ctx.manifest.profile });
    if (revision) {
      // Whatever a person could watch gets a revision, so a note can say which cut it was about.
      const { revision: rev, created } = await phase('revision', () =>
        snapshot(root, { ctx, kind: 'render', label }),
      );
      attachVideo(root, rev.id, {
        file: output,
        receipt: report,
        profile: ctx.manifest.profile,
      });
      report.revision = rev.id;
      writeJSON(`${output}.json`, report);
      record({ revision: rev.id });
      log.ok(
        `${created ? 'Revision' : 'Same content as revision'} ${rev.id} (review/revisions/${rev.id})`,
      );
    }
    return report;
  } finally {
    // A render that failed while the sound was still mixing waits for it before cleaning up.
    await sound.catch(() => {});
    for (const f of [raw, silent, audio, encoded, finished, nativeReport])
      fs.rmSync(f, { force: true });
  }
}
