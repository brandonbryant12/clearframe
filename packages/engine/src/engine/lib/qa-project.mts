import {
  checkLoop,
  checkDrop,
  transitionCovers,
} from './qa-project-checks.mjs';
import * as Schema from 'effect/Schema';
import { RenderReceiptSchema } from '../schemas.mjs';
import type { QaFinding } from './qa-contracts.mjs';
import { frameSignals } from './qa-signals.mjs';
import { frameFindings } from './qa-frame-findings.mjs';
import { adviseHeld } from './qa-held-advice.mjs';
import fs from 'node:fs';
import path from 'node:path';

import { computeTiming } from './timing.mjs';
import { loadStoryboard } from './project.mjs';
import { writeJSON } from './util.mjs';

import { sha256File } from './store.mjs';
import { bindVideo, identityFindings, recheck } from './evidence.mjs';
import { reviewGeometry } from '../../film/render-geometry.mjs';

import { grid, decode, median, r2, HELD } from './qa-pixels.mjs';
import { timeFindings } from './qa-time.mjs';
import {
  deliveryFindings,
  probeStreams,
  measureLoudness,
  moovFirst,
} from './qa-delivery.mjs';
import { sheets } from './qa-sheets.mjs';

export async function qaProject(
  root: string,
  { video, loop = false }: { video?: string; loop?: boolean } = {},
) {
  const file = path.resolve(video ?? path.join(root, 'build/video.mp4'));
  if (!fs.existsSync(file))
    throw new Error(`No film at ${file}; render first.`);
  const sb = loadStoryboard(root);
  const timing = computeTiming(root);
  const probe = probeStreams(file);
  // What this QA is about: the receipt is checked against the video's bytes and the working copy
  // before anything in it (a draft's reduced size) is believed.
  const evidence = bindVideo(root, file, { timing, probe });
  let receipt;
  if (evidence.scope === 'bound' && evidence.receipt)
    receipt = Schema.decodeUnknownSync(RenderReceiptSchema)(
      JSON.parse(fs.readFileSync(evidence.receipt, 'utf8')),
    );
  const output = reviewGeometry(sb.format, receipt, {
    videoHash: evidence.videoSha256,
    storyboardHash: sha256File(path.join(root, 'storyboard.json')),
  });
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (!v?.width || !v.height)
    throw new Error('The video stream has no usable dimensions.');
  const [w, h] = grid(v.width, v.height);
  // The sheets and the loudness read the same file as the picture analysis: started first, they
  // run beside the decode instead of after it.
  const dir = path.join(root, 'build', 'qa');
  fs.mkdirSync(dir, { recursive: true });
  const portrait = v.height > v.width;
  const counted = Number(v.nb_frames) > 0 ? Number(v.nb_frames) : timing.frames;
  const sheeting = sheets(file, dir, {
    portrait,
    seconds: counted / timing.fps,
  });
  sheeting.catch(() => {});
  const hearing = probe.streams.some((s) => s.codec_type === 'audio')
    ? measureLoudness(file)
    : Promise.resolve(null);
  const film = decode(file, w, h);
  const n = film.frames,
    fps = timing.fps;
  const same = timing.frames === n;
  const beats = same ? timing.beats : [];
  const captionShare = h > w ? 0.24 : 0.16;
  const captionBand = sb.captions ? Math.round(h * captionShare) : 0;
  const { d, skip, second, local } = frameSignals(
    film,
    beats,
    fps,
    w,
    h,
    captionBand,
    same,
  );
  const worlds = Object.fromEntries(
    sb.beats.map((b) => [b.id, b.props?.world ?? null]),
  );
  const covers = transitionCovers(sb);
  const holds = new Set(
    sb.beats.filter((b) => b.pace === 'hold').map((b) => b.id),
  );
  const findings: QaFinding[] = [
    ...identityFindings(evidence),
    ...timeFindings({
      d,
      skip,
      second,
      local,
      fps,
      beats,
      worlds,
      covers,
      holds,
    }),
  ];
  findings.push(...frameFindings({ sb, beats, film, fps, w, h, holds }));
  adviseHeld(findings, beats, sb);
  if (!same)
    findings.unshift({
      level: 'warn',
      kind: 'timeline',
      message: `the film has ${n} frames, the storyboard ${timing.frames}: findings carry no beat names (render again)`,
    });
  if (loop) checkLoop(film, d, findings);
  const loudness = await hearing;
  findings.push(
    ...deliveryFindings(probe, {
      loudness,
      target: sb.mix?.loudness ?? -14,
      fps,
      frames: timing.frames,
      width: output.width,
      height: output.height,
      moovFirst: moovFirst(file),
    }),
  );
  if (loudness) checkDrop(file, timing.music?.drop, findings);
  // The phone sheet is what a viewer's thumb sees: 360 px wide frames.
  await sheeting;
  // Everything above was read from the file over seconds: it must still be the file that was bound.
  const replaced = recheck(evidence);
  if (replaced)
    findings.unshift({
      level: 'error',
      kind: 'identity',
      message: `${replaced}: these measurements belong to neither version. Run qa again.`,
    });
  const change = second.filter(Number.isFinite);
  const summary = {
    seconds: r2(n / fps),
    frames: n,
    changePerSecond: r2(median(change)),
    heldSeconds: r2(
      findings
        .filter((f) => f.kind === 'held' && !f.deliberate)
        .reduce((s, f) => s + (f.seconds ?? 0), 0),
    ),
    deliberateSeconds: r2(
      findings
        .filter((f) => f.kind === 'held' && f.deliberate)
        .reduce((s, f) => s + (f.seconds ?? 0), 0),
    ),
    pops: findings.filter((f) => f.kind === 'pop').length,
    loudness,
    audio: probe.streams.some((x) => x.codec_type === 'audio'),
    color: [
      v.color_primaries,
      v.color_transfer,
      v.color_space,
      v.color_range,
    ].join('/'),
    evidence: evidence.scope,
  };
  writeJSON(path.join(dir, 'qa.json'), {
    video: file,
    // Which film these measurements are about, and what that was checked against.
    evidence,
    output: {
      width: output.width,
      height: output.height,
      scale: output.scale,
      draft: output.draft,
    },
    summary,
    findings,
    change: change.map(r2),
    heldAnalysis: {
      ...HELD,
      region: same
        ? 'full frame, within each beat'
        : 'full frame (timeline mismatch)',
      advisory: true,
    },
  });
  return { dir, summary, findings, evidence };
}
