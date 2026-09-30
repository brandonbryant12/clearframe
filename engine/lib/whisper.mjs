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

export function whisperAvailable() {
  return spawnSync('whisper', ['--help'], { encoding: 'utf8' }).status === 0;
}

/** Measure word timings for every current narration take (or `--beat`) with local Whisper. */
export async function whisperAlign(root, { beat, model = 'base', language } = {}) {
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
  if (!beats.length) throw new Error('No current narration takes to align; record or import voice first.');
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
    const r = spawnSync(
      'whisper',
      [
        joined,
        '--model',
        model,
        '--word_timestamps',
        'True',
        '--output_format',
        'json',
        '--output_dir',
        tmp,
        '--fp16',
        'False',
        ...((language ?? sb.voice.language) ? ['--language', language ?? sb.voice.language] : ['--language', 'en']),
      ],
      { encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`whisper failed: ${(r.stderr || r.stdout).slice(-800)}`);
    const heard = timedWords(JSON.parse(fs.readFileSync(path.join(tmp, 'narration.json'), 'utf8')));
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
      if (clamped.some(w => w.t1 <= w.t0)) {
        report.push({ id: x.b.id, status: 'timings did not fit the take' });
        return;
      }
      const meta = readJSON(x.metaFile);
      writeJSON(x.metaFile, {
        ...meta,
        words: clamped,
        alignment: {
          kind: interpolated ? 'estimated' : 'measured',
          provider: `whisper-${model}`,
          audioHash: audioHash(x.wav),
          ...(interpolated ? { interpolatedWords: interpolated } : {}),
          createdAt: new Date().toISOString(),
        },
      });
      report.push({
        id: x.b.id,
        status: interpolated ? `${interpolated} word(s) interpolated (estimated)` : 'measured',
      });
    });
    return report;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
