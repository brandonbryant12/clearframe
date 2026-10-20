import fs from 'node:fs';
import path from 'node:path';

import {
  prepareProject,
  preparedJob,
  nativeCommand,
  checkProject,
} from '../../film/prepare.mjs';
import { renderProject } from '../../film/render.mjs';
import { qaProject } from './qa.mjs';
import { ffmpeg } from './util.mjs';
import { writeJSONAtomic } from './store.mjs';

import { errorMessage } from './errors.mjs';
import {
  project,
  relative,
  listPngs,
  comparePixels,
  rgb,
  phoneSheet,
} from './library-bar-media.mjs';
import type {
  BarCase,
  BarCaseResult,
  BarContext,
} from './library-bar-contracts.mjs';
export async function runBarCase(
  entry: BarCase,
  ctx: BarContext,
  result: BarCaseResult,
): Promise<void> {
  const { out, base, fixture, prepared } = ctx;
  const root = path.join(out, entry.id);
  try {
    project(entry, root, base);
    result.project = relative(out, path.join(root, 'storyboard.json'));
    const { result: source } = preparedJob(root, { draft: true }),
      job = source.job;
    if (job.frames / job.fps > 30 || job.width * job.height > 1920 * 1920)
      throw new Error(
        'Library bar cases are limited to 30 seconds and at most 1920×1920 pixels',
      );
    const extra = (fixture.sensitivities ?? [])
      .filter((s) => s.base === entry.id || s.changed === entry.id)
      .map((s) => s.at);
    const times = [
      ...new Set([
        ...(entry.at ?? [
          (job.frames / job.fps) * 0.25,
          (job.frames / job.fps) * 0.75,
        ]),
        ...extra,
      ]),
    ].sort((a, b) => a - b);
    if (
      times.length > 6 ||
      times.some((t) => t < 0 || t >= job.frames / job.fps)
    )
      throw new Error(
        `${entry.id}: at most six sample/sensitivity times, all inside the film`,
      );
    const indices = [
      ...new Set(
        times.map((t) => Math.min(job.frames - 1, Math.round(t * job.fps))),
      ),
    ];
    const checks = await checkProject(root, { draft: true });
    result.errors.push(...checks.errors);
    result.warnings.push(...checks.warnings);
    writeJSONAtomic(path.join(root, 'checks.json'), checks);
    const video = path.join(root, 'video.mp4');
    const receipt = await renderProject(root, {
      draft: true,
      out: video,
      noAudio: entry.audio !== true,
      revision: false,
    });
    result.video = relative(out, video);
    result.videoSha256 = receipt.outputSha256;
    const qa = await qaProject(root, { video });
    result.errors.push(
      ...qa.findings
        .filter((f) => f.level === 'error')
        .map((f) => `${f.kind}: ${f.message}`),
    );
    result.warnings.push(
      ...qa.findings
        .filter((f) => f.level === 'warn')
        .map((f) => `${f.kind}: ${f.message}`),
    );
    result.qaPhone = relative(out, path.join(qa.dir, 'phone.png'));
    const ctx = await prepareProject(root, { draft: true }),
      nativeDir = path.join(root, 'native-frames'),
      decodedDir = path.join(root, 'decoded-frames');
    fs.mkdirSync(nativeDir);
    fs.mkdirSync(decodedDir);
    await nativeCommand(ctx, 'frame', [indices.join(','), '-o', nativeDir]);
    const nativeFiles = listPngs(nativeDir);
    await ffmpeg([
      '-y',
      '-i',
      video,
      '-vf',
      `select=${indices.map((n) => `eq(n\\,${n})`).join('+')}`,
      '-fps_mode',
      'vfr',
      '-start_number',
      '0',
      '-threads',
      '2',
      path.join(decodedDir, 'frame-%03d.png'),
    ]);
    const decodedFiles = listPngs(decodedDir);
    if (
      nativeFiles.length !== indices.length ||
      decodedFiles.length !== indices.length
    )
      throw new Error('The native and encoded sample frame counts differ');
    const frames = new Map<number, string>();
    for (const [i, frame] of indices.entries()) {
      const metrics = comparePixels(rgb(nativeFiles[i]), rgb(decodedFiles[i]));
      const psnr = metrics.psnr;
      if (psnr < (entry.minPsnr ?? 32))
        result.errors.push(
          `Frame ${frame}: native/encoded PSNR ${psnr.toFixed(2)} dB is below ${entry.minPsnr ?? 32}`,
        );
      result.samples.push({
        frame,
        time: frame / job.fps,
        native: relative(out, nativeFiles[i]),
        decoded: relative(out, decodedFiles[i]),
        psnr: Number.isFinite(psnr) ? psnr : 'identical',
      });
      frames.set(frame, nativeFiles[i]);
    }
    result.phone = relative(out, await phoneSheet(nativeFiles, root));
    prepared.set(entry.id, { job, frames });
    result.status = result.errors.length ? 'failed' : 'passed';
  } catch (e) {
    result.errors.push(errorMessage(e));
    result.status = 'failed';
  }
}
