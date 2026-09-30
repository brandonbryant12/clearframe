import fs from 'node:fs';
import path from 'node:path';
import { loadStoryboard, paths } from './project.mjs';
import { tokenize } from './timing.mjs';
import { audioHash, normalizeWords, validateWords } from './word-timing.mjs';
import { ffmpeg, hashOf, readJSON, writeJSON, wavDuration } from './util.mjs';
import { post } from '../../skills/gemini-tts/scripts/tts.mjs';
import { uploadAudio, waitFile, deleteFile } from './google-files.mjs';

export const transcriptionRequest = uri => ({
  model: 'gemini-3.5-transcribe',
  input: [{ type: 'audio', uri, mime_type: 'audio/wav' }],
  generation_config: { transcription_config: { mode: { type: 'verbatim', timestamp_granularities: ['word'] } } },
});
export async function transcribeSpeech(root, { beat, budget, force = false } = {}) {
  const sb = loadStoryboard(root),
    b = sb.beats.find(b => b.id === beat);
  if (!b?.vo) throw new Error('Choose a narrated beat with --beat');
  const file = path.join(paths(root).vo, `${beat}.wav`),
    meta = readJSON(path.join(paths(root).vo, `${beat}.json`), null);
  if (!fs.existsSync(file) || meta?.textHash !== hashOf(b.vo))
    throw new Error('Record or import the current narration before alignment');
  const before = audioHash(file),
    estimate = (wavDuration(file) / 60) * 0.005;
  if (!force && meta.alignment?.kind === 'measured' && meta.alignment.audioHash === before) {
    try {
      return validateWords(meta.words, tokenize(b.vo), wavDuration(file));
    } catch {}
  }
  if ((budget ?? sb.budget) != null && estimate > (budget ?? sb.budget))
    throw new Error('Estimated transcription cost exceeds the budget');
  let uploaded;
  try {
    uploaded = await uploadAudio(file);
    await waitFile(uploaded.name);
    const result = await post('/interactions', transcriptionRequest(uploaded.uri), { retries: 0 });
    if (result.status !== 'completed') throw new Error(`Transcription ${result.status ?? 'incomplete'}`);
    // Retain the paid result even on a transcript mismatch so it can be reviewed/imported.
    writeJSON(path.join(paths(root).vo, `${beat}.transcription.json`), result);
    if (audioHash(file) !== before) throw new Error('Recording changed during transcription; align the new take');
    return alignSpeech(root, { beat, words: result, provider: 'gemini-3.5-transcribe' });
  } finally {
    if (uploaded)
      await deleteFile(uploaded.name).catch(() =>
        console.warn('Uploaded speech cleanup failed; Google Files expires it after 48 hours.'),
      );
  }
}

export function alignSpeech(root, { beat, words, provider = 'imported' }) {
  const sb = loadStoryboard(root),
    b = sb.beats.find(b => b.id === beat);
  if (!b?.vo) throw new Error('Choose a beat with narration using --beat');
  const P = paths(root),
    file = path.join(P.vo, `${beat}.wav`),
    metaFile = path.join(P.vo, `${beat}.json`);
  const meta = readJSON(metaFile, null);
  if (!fs.existsSync(file) || meta?.textHash !== hashOf(b.vo))
    throw new Error('Record or import the current narration before alignment.');
  const duration = wavDuration(file) ?? meta.duration;
  const normalized = validateWords(normalizeWords(words), tokenize(b.vo), duration);
  writeJSON(metaFile, {
    ...meta,
    duration,
    words: normalized,
    alignment: { kind: 'measured', provider, audioHash: audioHash(file), createdAt: new Date().toISOString() },
  });
  return normalized;
}

/** Import a recording without trimming silence; supplied offsets retain the original clock. */
export async function importSpeech(root, { beat, audio, transcript, words }) {
  const sb = readJSON(path.join(root, 'storyboard.json')),
    b = sb.beats.find(b => b.id === beat);
  if (!b) throw new Error(`No beat ${beat}`);
  if (!transcript?.trim()) throw new Error('A transcript is required (plain text or derived from timed words).');
  const P = paths(root);
  fs.mkdirSync(P.vo, { recursive: true });
  const out = path.join(P.vo, `${beat}.wav`),
    tmp = path.join(P.vo, `${beat}.import.wav`);
  try {
    await ffmpeg(['-y', '-i', path.resolve(audio), '-vn', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', tmp]);
    const duration = wavDuration(tmp);
    if (!(duration > 0)) throw new Error('Imported audio is empty');
    const normalized = words ? validateWords(normalizeWords(words), tokenize(transcript), duration) : null;
    fs.renameSync(tmp, out);
    b.vo = transcript.trim();
    delete b.duration;
    writeJSON(path.join(root, 'storyboard.json'), sb);
    writeJSON(path.join(P.vo, `${beat}.json`), {
      provider: 'imported',
      textHash: hashOf(b.vo),
      text: b.vo,
      duration,
      ...(normalized
        ? { words: normalized, alignment: { kind: 'measured', provider: 'imported', audioHash: audioHash(out) } }
        : {}),
      createdAt: new Date().toISOString(),
    });
    return { duration, wordTiming: normalized ? 'measured' : 'estimated' };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
