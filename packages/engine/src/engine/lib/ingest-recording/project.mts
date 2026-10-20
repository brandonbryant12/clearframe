import fs from 'node:fs';
import path from 'node:path';
import { round, writeJSON } from '../util.mjs';

import { paths } from '../project.mjs';
import { readPCM } from '../levels.mjs';
import { segmentWords, cutPoints } from '../ingest-words.mjs';

import type { Brand } from '../brand.mjs';

import type {
  RecordingOptions,
  RecordingReceipt,
  RecordingRequest,
} from './contracts.mjs';
import {
  chosenDirection,
  applyRecordingTreatment,
  writeRecordingNotes,
} from './notes.mjs';
import { extractMaster, recordingWords, writeTranscript } from './source.mjs';
import { speakerCast, writeBeats, recordingStoryboard } from './beats.mjs';

/**
 * Import a recording (podcast, interview, talk) as consecutive beats. The recording is cut
 * at frame-aligned points inside pauses, so the beats replay it exactly with no gaps;
 * timings from a word-level transcript are measured, not estimated.
 */
export async function writeRecording(
  root: string,
  o: RecordingOptions,
  brand: Brand | null,
): Promise<RecordingReceipt> {
  const { from = 0, to, fps = 30, speakers = {} } = o;
  const { treatment, playbook } = await chosenDirection(o);
  const P = paths(root);
  if (fs.existsSync(P.storyboard))
    throw new Error(
      `${root} already has a storyboard; ingest a recording into a new directory.`,
    );
  if (!o.words)
    throw new Error(
      'Recording import needs word timestamps: pass --words words.json (WhisperX, Gemini, or {w,t0,t1,speaker} lists) or run with --transcribe.',
    );
  fs.mkdirSync(P.vo, { recursive: true });
  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  const master = path.join(root, 'source', 'recording.wav');
  await extractMaster(o.audio, master, from, to);
  const { rate, pcm } = readPCM(master);
  const duration = pcm.length / 2 / rate;
  const { words, scripted } = recordingWords(o.words, o.script, from, duration);
  const segs = segmentWords(words);
  const cuts = cutPoints(segs, duration, fps);
  writeTranscript(root, {
    audio: o.audio,
    master,
    rate,
    fps,
    from,
    to,
    duration,
    words,
  });
  const cast = speakerCast(segs, speakers);
  const beats = writeBeats(
    {
      pcm,
      rate,
      fps,
      from,
      cuts,
      voDir: P.vo,
      script: Boolean(o.script),
      vertical: Boolean(o.vertical),
    },
    segs,
  );
  const sb = recordingStoryboard(o, fps, cast, beats);
  await applyRecordingTreatment(sb, treatment, o.theme);
  const { applyBrand } = await import('../brand.mjs');
  const brandAssets = applyBrand(root, sb, brand, {
    recording: true,
    theme: o.theme,
  });
  writeJSON(P.storyboard, sb);
  await writeRecordingNotes(root, sb, {
    audio: o.audio,
    from,
    duration,
    beats: beats.length,
    direction: o.direction,
    treatment,
    playbook,
  });
  return {
    beats: beats.length,
    duration: round(duration, 2),
    speakers: Object.keys(cast),
    words: words.length,
    assets: brandAssets,
    ...(scripted ? { interpolated: scripted.interpolated } : {}),
  };
}

/** Recording and brand intake is a transaction just like document intake. */
export async function ingestRecording(
  destination: string,
  options: RecordingRequest,
): Promise<RecordingReceipt> {
  const root = path.resolve(destination);
  if (
    fs.existsSync(root) &&
    (!fs.statSync(root).isDirectory() || fs.readdirSync(root).length)
  )
    throw new Error(
      `${root} is not empty (it holds ${fs.readdirSync(root).slice(0, 4).join(', ')}); ingest writes a whole new project, so give it a folder that does not exist yet and keep your own files elsewhere.`,
    );
  const { readBrand } = await import('../brand.mjs');
  const { useProject } = await import('../../../film/library.mjs');
  useProject(null);
  const { brand: brandFile, ...recording } = options;
  const brand = readBrand(brandFile && path.resolve(brandFile));
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const staging = fs.mkdtempSync(
    path.join(path.dirname(root), '.clearframe-recording-'),
  );
  try {
    const project = path.join(staging, 'project');
    const receipt = await writeRecording(project, recording, brand);
    writeJSON(path.join(project, 'intake.json'), {
      version: 1,
      status: 'recording-needs-pictures',
      ...receipt,
    });
    if (fs.existsSync(root)) fs.rmdirSync(root);
    fs.renameSync(project, root);
    return receipt;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    useProject(null);
  }
}
