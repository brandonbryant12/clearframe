import fs from 'node:fs';
import path from 'node:path';
import { hashOf, pcmToWav, round, writeJSON } from '../util.mjs';
import { audioHash } from '../word-timing.mjs';

import type { TranscriptWord } from '../ingest-words.mjs';

import type { Beat, Speaker, Storyboard } from '../../domain.mjs';
import type {
  SpeakerOverride,
  SpeakerCast,
  BeatClock,
  RecordingOptions,
} from './contracts.mjs';

export function speakerCast(
  segs: TranscriptWord[][],
  speakers: Record<string, SpeakerOverride>,
): SpeakerCast {
  const ids = new Set(
    segs.flatMap((s) =>
      s.map((w) => w.speaker).filter((id): id is string => Boolean(id)),
    ),
  );
  const cast: Record<string, Speaker> = {};
  [...ids].forEach((id, i) => {
    const given = speakers[id] ?? {};
    cast[id] = {
      // A role-named turn ("host:", "guest:") reads as its role; a bare id as "Speaker N".
      name:
        given.name ??
        (/^[a-z]+$/i.test(id)
          ? id[0].toUpperCase() + id.slice(1)
          : `Speaker ${id}`),
      ...(given.role ? { role: given.role } : {}),
      color: given.color ?? (i % 2 ? 'accent2' : 'accent'),
    };
  });
  return cast;
}

export function sliceTimings(
  seg: TranscriptWord[],
  start: number,
  sliceDur: number,
): { w: string; t0: number; t1: number }[] {
  const timed = seg.map((w) => ({
    w: w.w,
    t0: round(Math.max(0, w.t0 - start), 4),
    t1: round(
      Math.max(
        Math.min(sliceDur, w.t1 - start),
        Math.max(0, w.t0 - start) + 0.01,
      ),
      4,
    ),
  }));
  for (let k = 1; k < timed.length; k++)
    if (timed[k].t0 < timed[k - 1].t1) timed[k].t0 = timed[k - 1].t1;
  return timed;
}

/** One beat's slice of the recording, its measured words, and the beat that plays it. */
export function writeBeat(
  c: BeatClock,
  seg: TranscriptWord[],
  i: number,
  wordIndex: number,
): Beat {
  const id = `s${String(i + 1).padStart(3, '0')}`,
    start = c.cuts[i],
    end = c.cuts[i + 1];
  const a = Math.round(start * c.rate),
    b = Math.min(c.pcm.length / 2, Math.round(end * c.rate));
  const slice = Buffer.alloc((Math.round(end * c.rate) - a) * 2);
  c.pcm.copy(slice, 0, a * 2, b * 2);
  const file = path.join(c.voDir, `${id}.wav`);
  fs.writeFileSync(file, pcmToWav(slice, { sampleRate: c.rate }));
  const text = seg.map((w) => w.w).join(' '),
    sliceDur = slice.length / 2 / c.rate;
  // Interpolated words are estimates: a beat containing any is not labelled measured.
  const estimated = seg.filter((w) => w.estimated).length;
  writeJSON(path.join(c.voDir, `${id}.json`), {
    provider: 'imported',
    textHash: hashOf(text),
    text,
    duration: sliceDur,
    words: sliceTimings(seg, start, sliceDur),
    alignment: {
      kind: estimated ? 'estimated' : 'measured',
      provider: c.script ? 'script+recognizer' : 'imported-transcript',
      audioHash: audioHash(file),
      ...(estimated ? { interpolatedWords: estimated } : {}),
    },
    // start/end: seconds in the original file; span: frames on source/recording.wav's clock;
    // words: this beat's share of source/words.json.
    source: {
      file: 'source/recording.wav',
      start: round(start + c.from, 4),
      end: round(end + c.from, 4),
      offset: c.from,
      fps: c.fps,
      span: [Math.round(start * c.fps), Math.round(end * c.fps)],
      words: [wordIndex, wordIndex + seg.length],
    },
    createdAt: new Date().toISOString(),
  });
  const stamp = (t: number): string =>
    `${String(Math.floor((t + c.from) / 60)).padStart(2, '0')}:${((t + c.from) % 60).toFixed(1).padStart(4, '0')}`;
  return {
    id,
    block: 'kinetic',
    vo: text,
    ...(seg[0].speaker ? { speaker: seg[0].speaker } : {}),
    note: `${stamp(start)}–${stamp(end)}`,
    props: { mode: 'highlight', align: 'center', maxWords: c.vertical ? 5 : 8 },
  };
}

export function writeBeats(c: BeatClock, segs: TranscriptWord[][]): Beat[] {
  let wordIndex = 0;
  return segs.map((seg, i) => {
    const beat = writeBeat(c, seg, i, wordIndex);
    wordIndex += seg.length;
    return beat;
  });
}

export function recordingStoryboard(
  o: RecordingOptions,
  fps: number,
  cast: Record<string, Speaker>,
  beats: Beat[],
): Storyboard {
  return {
    version: 2,
    title: o.title ?? path.basename(o.audio).replace(/\.[^.]+$/, ''),
    format: { preset: o.vertical ? 'vertical' : 'landscape', fps },
    theme: o.theme ?? 'midnight',
    motion: { preset: 'snappy', intensity: 0.7 },
    transition: 'cut',
    texture: { grain: 0.3, vignette: 0.4 },
    // Speech stays on screen when a beat becomes a picture: social pop captions on a vertical
    // clip, phrase captions on a plate otherwise (kinetic beats never double them).
    captions: o.vertical ? 'pop' : true,
    music: false,
    pacing: { continuous: true },
    ...(Object.keys(cast).length ? { speakers: cast } : {}),
    sources: [
      { id: 'recording', title: `Recording: ${path.basename(o.audio)}` },
    ],
    beats,
  };
}
