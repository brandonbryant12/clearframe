import fs from 'node:fs';
import path from 'node:path';
import { planTakes } from './takes.mjs';
import { loadStoryboard } from './project.mjs';
import { isRecorded, readMeta, readTranscript } from './recording-model.mjs';

import { fingerprint, readJSONFile, sha256File } from './store.mjs';
import { decodeStoryboard } from '../schemas.mjs';

import type {
  FilmPrints,
  PreparedContext,
  Timeline,
} from './revisions-model.mjs';
import type { Beat } from '../domain.mjs';
import {
  pick,
  JOB_FILM_KEYS,
  LOOK_KEYS,
  SOUND_KEYS,
  PRINT_SCHEME,
} from './revisions-timeline-common.mjs';
import type { Shared, BeatInputs } from './revisions-timeline-contracts.mjs';

import { prints } from './revisions-timeline-prints.mjs';
import { timelineBeat } from './revisions-timeline-beat.mjs';

export function plannedTakes(root: string): Map<string, string> {
  const planned = new Map<string, string>();
  try {
    for (const t of planTakes(loadStoryboard(root)))
      for (const b of t.beats) planned.set(b.id, t.id);
  } catch {}
  return planned;
}

/**
 * The review timeline of a prepared project: per beat its place, words (film clock), source
 * mapping and fingerprints. Fingerprints never include a beat's absolute start, so a beat that
 * only moved keeps them; `rendered` folds in the previous beat when a transition draws it.
 */
export function reviewTimeline(ctx: PreparedContext): Timeline {
  const { root, job, timing, manifest } = ctx;
  const raw = decodeStoryboard(
    readJSONFile(path.join(root, 'storyboard.json')),
  );
  const rawById = new Map(raw.beats.map((b) => [b.id, b]));
  // The recording beats replay, by its bytes: its record in source/recording.json may be stale.
  const sourceSha = fs.existsSync(path.join(root, 'source', 'recording.wav'))
    ? sha256File(path.join(root, 'source', 'recording.wav'))
    : null;
  const { beats: _beats, ...filmRaw } = raw;
  const jobFilm = pick(job, JOB_FILM_KEYS);
  const film: FilmPrints = {
    look: fingerprint({ raw: pick(filmRaw, LOOK_KEYS), job: jobFilm }),
    sound: fingerprint({
      raw: pick(filmRaw, SOUND_KEYS),
      music: timing.music?.src
        ? (manifest.hashes[timing.music.src] ?? null)
        : null,
    }),
    voice: fingerprint(filmRaw.voice ?? null),
    data: fingerprint({
      sources: filmRaw.sources ?? [],
      assets: filmRaw.assets ?? [],
    }),
    renderer: fingerprint({
      renderer: manifest.rendererSourceHash,
      fonts: manifest.fontHashes,
    }),
  };
  const planned = plannedTakes(root);
  const transcript = readTranscript(root);
  const shared: Shared = {
    root,
    ctx,
    film,
    jobFilm,
    sources: filmRaw.sources ?? [],
    sourceSha,
    transcript,
  };
  let prevOwn: string | null = null;
  const beats = job.beats.map((jb, i) => {
    const b: Partial<Beat> = rawById.get(jb.id) ?? {};
    const meta = b.vo ? readMeta(root, jb.id) : null;
    const recorded =
      isRecorded(meta) && transcript ? { meta, transcript } : null;
    const inputs: BeatInputs = {
      jb,
      i,
      tb: timing.beats[i],
      b,
      meta,
      recorded,
    };
    const beatPrints = prints(shared, inputs, prevOwn);
    prevOwn = beatPrints.own;
    return timelineBeat(shared, inputs, beatPrints, planned.get(jb.id) ?? null);
  });
  return {
    version: 1,
    // Fingerprints from different schemes are not comparable; impact() says so.
    printScheme: PRINT_SCHEME,
    title: timing.title,
    fps: timing.fps,
    frames: timing.frames,
    duration: timing.duration,
    width: timing.width,
    height: timing.height,
    music: timing.music?.src
      ? { src: timing.music.src, offset: timing.music.offset ?? 0 }
      : null,
    film,
    beats,
  };
}
