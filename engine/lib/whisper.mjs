// Free, local word timestamps with OpenAI Whisper (the `whisper` CLI, MIT). Every narrated
// beat is transcribed in one pass, then each beat's own text is mapped onto what Whisper heard.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadStoryboard, paths } from './project.mjs';
import { tokenize } from './timing.mjs';
import { alignScript } from './word-align.mjs';
import { audioHash } from './word-timing.mjs';
import { ffmpeg, hashOf, readJSON, writeJSON, wavDuration } from './util.mjs';
import { timedWords } from './ingest.mjs';

/**
 * whisper.cpp (`whisper-cli`, MIT) with a local ggml model, when one is installed: the same
 * Whisper weights on the GPU, about ten times faster than the Python CLI and with a fraction of
 * its CPU, which matters when several films align at once. The model is the file named by
 * CLEARFRAME_WHISPER_MODEL, or ggml-base(.en).bin in ~/.cache/whisper-cpp
 * (huggingface.co/ggerganov/whisper.cpp). Returns null without both.
 */
export function whisperCpp(language = 'en') {
  if (spawnSync('whisper-cli', ['--help'], { encoding: 'utf8' }).status !== 0) return null;
  const env = process.env.CLEARFRAME_WHISPER_MODEL;
  if (env) return fs.existsSync(env) ? env : null;
  const dir = path.join(os.homedir(), '.cache/whisper-cpp');
  const names = language === 'en' ? ['ggml-base.en.bin', 'ggml-base.bin'] : ['ggml-base.bin'];
  return names.map(n => path.join(dir, n)).find(f => fs.existsSync(f)) ?? null;
}

export function whisperAvailable(language = 'en') {
  return !!whisperCpp(language) || spawnSync('whisper', ['--help'], { encoding: 'utf8' }).status === 0;
}

/**
 * Words heard in a 16 kHz mono WAV, with their times, as `timedWords` reads them, plus which
 * recognizer measured them. whisper.cpp splits its output one word per segment (`-ml 1 -sow`);
 * the Python CLI reports words inside segments.
 */
export function transcribeWords(wav, { model = 'base', language = 'en', dir } = {}) {
  const cpp = model === 'base' ? whisperCpp(language) : null;
  if (cpp) {
    const out = path.join(dir, 'cpp');
    const r = spawnSync('whisper-cli', ['-m', cpp, '-f', wav, '-l', language, '-ml', '1', '-sow', '-oj', '-of', out, '-np'], {
      encoding: 'utf8',
    });
    if (r.status === 0 && fs.existsSync(`${out}.json`)) {
      const segments = JSON.parse(fs.readFileSync(`${out}.json`, 'utf8')).transcription ?? [];
      const words = segments
        .map(s => ({ word: String(s.text ?? '').trim(), start: s.offsets.from / 1000, end: s.offsets.to / 1000 }))
        .filter(w => w.word && !/^\[.*\]$/.test(w.word));
      return { words, provider: `whisper.cpp-${path.basename(cpp).replace(/^ggml-|\.bin$/g, '')}` };
    }
  }
  const r = spawnSync(
    'whisper',
    [wav, '--model', model, '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', dir, '--fp16', 'False', '--language', language],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`whisper failed: ${(r.stderr || r.stdout).slice(-800)}`);
  const json = path.join(dir, `${path.basename(wav).replace(/\.[^.]+$/, '')}.json`);
  return { words: JSON.parse(fs.readFileSync(json, 'utf8')), provider: `whisper-${model}` };
}

/** Measure word timings for every current narration take (or `--beat`) with local Whisper. */
export async function whisperAlign(root, { beat, model = 'base', language, force = false } = {}) {
  if (!whisperAvailable())
    throw new Error(
      'Local Whisper is not installed. Install it (brew install openai-whisper, or pip install openai-whisper), or use align --transcribe (paid) or --words.',
    );
  const sb = loadStoryboard(root),
    P = paths(root);
  const beats = sb.beats
    .filter(b => b.vo && (!beat || b.id === beat))
    .map(b => ({ b, wav: path.join(P.vo, `${b.id}.wav`), metaFile: path.join(P.vo, `${b.id}.json`) }))
    .filter(x => fs.existsSync(x.wav) && readJSON(x.metaFile, null)?.textHash === hashOf(x.b.vo));
  // A slice of an imported recording was measured at import against the whole recording and its
  // script; measuring the slice alone again only loses words at its edges.
  const kept = force ? [] : beats.filter(x => { const m = readJSON(x.metaFile, null); return m?.provider === 'imported' && m.alignment?.kind === 'measured'; });
  if (kept.length) {
    beats.splice(0, beats.length, ...beats.filter(x => !kept.includes(x)));
    if (!beats.length) return kept.map(x => ({ id: x.b.id, status: 'measured from the recording at import (kept; --force re-measures the slice alone)' }));
  }
  if (!beats.length) {
    // An imported recording is its own narration: ingest measured its words already, and its
    // takes stop matching when someone rewrites `vo` instead of cutting the recording.
    if (fs.existsSync(path.join(root, 'source', 'recording.wav'))) {
      const changed = sb.beats.filter(b => b.vo && (!beat || b.id === beat) && fs.existsSync(path.join(P.vo, `${b.id}.json`)) && readJSON(path.join(P.vo, `${b.id}.json`), null)?.textHash !== hashOf(b.vo)).map(b => b.id);
      throw new Error(
        changed.length
          ? `This film plays an imported recording, and the vo of ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ' …' : ''} no longer matches what was recorded. A recording is edited with cut, uncut, split and merge (docs/editing.md), never by rewriting vo: put the words back (or ingest again) and use those.`
          : 'This film plays an imported recording, whose words were measured when it was ingested (source/words.json); there are no voice takes to align. Its timings are already measured: go on with sheet and draft.',
      );
    }
    throw new Error('No current narration takes to align; record or import voice first.');
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-whisper-'));
  try {
    // One pass: beats separated by a second of silence, so no word straddles two takes.
    const gap = 1.0,
      offsets = [];
    let cursor = 0;
    for (const x of beats) {
      offsets.push(cursor);
      cursor += wavDuration(x.wav) + gap;
    }
    const inputs = beats.flatMap(x => ['-i', x.wav]);
    const filter =
      beats.map((_, i) => `[${i}:a]aresample=16000,apad=pad_dur=${gap}[a${i}]`).join(';') +
      ';' +
      beats.map((_, i) => `[a${i}]`).join('') +
      `concat=n=${beats.length}:v=0:a=1[out]`;
    const joined = path.join(tmp, 'narration.wav');
    await ffmpeg(['-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ac', '1', '-ar', '16000', joined]);
    const result = transcribeWords(joined, { model, language: language ?? sb.voice.language ?? 'en', dir: tmp });
    const heard = timedWords(result.words);
    const report = [];
    beats.forEach((x, i) => {
      const start = offsets[i],
        end = i + 1 < offsets.length ? offsets[i + 1] : Infinity,
        duration = wavDuration(x.wav);
      // Whisper's word times can lead the audio by a few hundred ms: assign by the silent gaps' midpoints.
      const mine = heard
        .filter(w => w.t0 >= start - gap / 2 && w.t0 < end - gap / 2)
        .map(w => ({ ...w, t0: Math.max(0, w.t0 - start), t1: Math.max(0.02, Math.min(duration, w.t1 - start)) }));
      const tokens = tokenize(x.b.vo).map(t => t.w);
      if (!mine.length) {
        report.push({ id: x.b.id, status: 'nothing heard' });
        return;
      }
      const { words, interpolated } = alignScript(tokens, mine);
      const clamped = words
        .map(w => ({ w: w.w, t0: Math.min(w.t0, duration - 0.02), t1: Math.min(w.t1, duration) }))
        .map((w, k, a) => ({ ...w, t0: k ? Math.max(w.t0, a[k - 1].t1) : w.t0 }));
      const misfit = clamped.filter(w => w.t1 <= w.t0);
      if (misfit.length) {
        report.push({
          id: x.b.id,
          status: `timings did not fit the take: ${misfit.length} word(s) heard past its end (${duration.toFixed(2)} s), first "${misfit[0].w}" at ${misfit[0].t0.toFixed(2)} s. The take is shorter than its words: re-record the voice for this beat (voice --draft) so narration and audio match`,
        });
        return;
      }
      const meta = readJSON(x.metaFile);
      writeJSON(x.metaFile, {
        ...meta,
        words: clamped,
        alignment: {
          kind: interpolated ? 'estimated' : 'measured',
          provider: result.provider,
          audioHash: audioHash(x.wav),
          ...(interpolated ? { interpolatedWords: interpolated } : {}),
          createdAt: new Date().toISOString(),
        },
      });
      report.push({
        id: x.b.id,
        status: interpolated
          ? `${interpolated} word(s) interpolated (estimated): ${words.filter(w => w.estimated).slice(0, 6).map(w => `"${w.w}"`).join(', ')}. Whisper heard something else there; reword the line so it is said as written (spell a figure the way it is spoken, or the reverse) and record it again`
          : 'measured',
      });
    });
    return [...kept.map(x => ({ id: x.b.id, status: 'measured from the recording at import (kept)' })), ...report];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
