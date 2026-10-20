import type { GenerateOptions } from '../generate-model.mjs';
import { money, guardBudget, assertApproved } from '../generate-model.mjs';
import { musicSpec, isRealtime } from '../generate-specs.mjs';
import fs from 'node:fs';

import path from 'node:path';
import { draftMusic } from '../audio.mjs';
import { loadStoryboard, paths } from '../project.mjs';
import { computeTiming } from '../timing.mjs';
import { hashOf, log } from '../util.mjs';
import {
  findMusicBed,
  writeMusicBed,
  readMusicBedMeta,
} from '../music-files.mjs';

import * as music from '../../../skills/lyria-music/scripts/music.mjs';

export async function scoreMusic(
  root: string,
  { draft = false, force = false, budget }: GenerateOptions = {},
) {
  const sb = loadStoryboard(root);
  if (!sb.music) {
    log.dim('storyboard.music is false — skipping music.');
    return;
  }
  const P = paths(root);
  fs.mkdirSync(P.music, { recursive: true });
  const timing = computeTiming(root);
  const seconds = Math.ceil(timing.duration + 2);
  const meta = readMusicBedMeta(root);
  if (draft) {
    if (
      meta?.provider &&
      meta.provider !== 'local' &&
      findMusicBed(root, meta) &&
      !force
    ) {
      log.dim(
        '  keeping the generated music (use --force to replace with a draft)',
      );
      return;
    }
    const out = path.join(P.music, `bed-draft-${process.pid}.wav`);
    try {
      await draftMusic(out, {
        seconds,
        bpm: sb.music.bpm ?? 72,
        style: sb.music.style ?? 'pad',
      });
      writeMusicBed(root, fs.readFileSync(out), 'wav', {
        provider: 'local',
        seconds,
        createdAt: new Date().toISOString(),
      });
    } finally {
      fs.rmSync(out, { force: true });
    }
    log.ok(`Draft music bed (${seconds}s) → assets/music/bed.wav`);
    return;
  }
  const spec = musicSpec(sb, timing),
    model = spec.model;
  if (meta?.hash === hashOf(spec) && findMusicBed(root, meta) && !force) {
    log.ok('Music is up to date.');
    return;
  }
  if (isRealtime(spec)) {
    assertApproved('music', [hashOf(spec)]);
    const { stream } =
      await import('../../../skills/lyria-music/scripts/realtime.mjs');
    log.step(`Lyria RealTime: streaming ${seconds}s (experimental)…`);
    const buf = await stream(spec, { seconds });
    writeMusicBed(root, buf, 'wav', {
      hash: hashOf(spec),
      provider: 'lyria-realtime',
      ...spec,
      createdAt: new Date().toISOString(),
    });
    log.ok('Music → assets/music/bed.wav');
    return;
  }
  const prompt = spec.prompt;
  assertApproved('music', [hashOf(spec)]);
  const cost = music.estimateCost({ model });
  log.step(`Lyria (${model}): ${seconds}s bed, ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  const r = await music.generateMusic({ prompt, model, format: 'mp3' });
  const file = writeMusicBed(root, r.data, r.ext, {
    hash: hashOf(spec),
    provider: 'lyria',
    model,
    prompt,
    notes: r.text,
    createdAt: new Date().toISOString(),
  });
  log.ok(`Music → ${file}${r.text ? ' (model notes saved in bed.json)' : ''}`);
  if (sb.music.file && sb.music.file !== file)
    log.warn(
      `storyboard.music.file points to ${sb.music.file}; the new bed is ${file}`,
    );
}
