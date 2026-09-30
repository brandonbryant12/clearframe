// Audio: voice post-processing + alignment, local draft voice/music, and the final mix.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveCue, SFX } from './sfx.mjs';
import { alignWords } from './timing.mjs';
import { ffmpeg, log, mediaDuration, round } from './util.mjs';

/** Trim leading/trailing silence (keeps a hair of room tone) and normalise to 24 kHz mono s16 WAV. */
export async function cleanVoice(input, output) {
  const tmp = `${output}.tmp.wav`;
  const trim = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04';
  await ffmpeg([
    '-y',
    '-i',
    input,
    '-af',
    `${trim},areverse,${trim},areverse`,
    '-ar',
    '24000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    tmp,
  ]);
  fs.renameSync(tmp, output);
}

/** Speech segments via ffmpeg silencedetect. */
export async function speechSegments(file, { noise = -38, minSilence = 0.14 } = {}) {
  const duration = await mediaDuration(file);
  const log = await ffmpeg(['-i', file, '-af', `silencedetect=noise=${noise}dB:d=${minSilence}`, '-f', 'null', '-'], {
    quiet: false,
  });
  const silences = [];
  let open = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) open = Math.max(0, parseFloat(s[1]));
    if (e && open != null) {
      silences.push([open, parseFloat(e[1])]);
      open = null;
    }
  }
  if (open != null) silences.push([open, duration]);
  const segs = [];
  let cursor = 0;
  for (const [a, b] of silences) {
    if (a > cursor) segs.push({ start: round(cursor), end: round(a) });
    cursor = b;
  }
  if (cursor < duration) segs.push({ start: round(cursor), end: round(duration) });
  return { duration, segments: segs };
}

/** Measure a voice take and align its words; returns metadata for assets/vo/<id>.json. */
export async function analyseVoice(file, text) {
  const { duration, segments } = await speechSegments(file);
  return { duration: round(duration), segments, words: alignWords(text, segments, duration) };
}

// ------------------------------------------------------------------ local drafts (free, offline)
/** Draft narration with the OS voice (macOS `say`, Linux `espeak-ng`/`espeak`). For timing only. */
export async function draftVoice(text, output, { wpm = 150, voice } = {}) {
  const mac = process.platform === 'darwin';
  const pauses = { 'short pause': 350, 'long pause': 800, breath: 250, sigh: 400 };
  const spoken = text
    .replace(/<([^>]+)>/g, (_, tag) =>
      mac && pauses[tag.trim().toLowerCase()] ? ` [[slnc ${pauses[tag.trim().toLowerCase()]}]] ` : ' ',
    )
    .replace(/\|[^|]*\|/g, ' ');
  const tmpBase = path.join(os.tmpdir(), `cf-say-${process.pid}-${Date.now()}`);
  let raw;
  if (mac) {
    raw = `${tmpBase}.aiff`;
    const args = ['-r', String(Math.round(wpm * 0.9)), '-o', raw];
    if (voice) args.unshift('-v', voice);
    const r = spawnSync('say', [...args, spoken]);
    if (r.status !== 0) throw new Error(`say failed: ${r.stderr}`);
  } else {
    raw = `${tmpBase}.wav`;
    const bin = ['espeak-ng', 'espeak'].find(b => spawnSync(b, ['--version']).status === 0);
    if (!bin)
      throw new Error('No local TTS found (need macOS `say` or espeak-ng). Use --provider gemini, or --silent.');
    const r = spawnSync(bin, ['-s', String(wpm), '-w', raw, spoken]);
    if (r.status !== 0) throw new Error(`${bin} failed`);
  }
  await cleanVoice(raw, output);
  fs.rmSync(raw, { force: true });
}

/** Draft music bed: a soft, slow chord pad synthesised by ffmpeg. Placeholder until Lyria. */
export async function draftMusic(output, { seconds = 60, bpm = 72 } = {}) {
  const bar = (60 / bpm) * 4; // one chord per bar
  const chords = [
    // Am9 · Fmaj7 · C(add9) · G6 — calm, unresolved, professional
    [110.0, 130.81, 164.81, 246.94],
    [87.31, 130.81, 164.81, 220.0],
    [130.81, 164.81, 196.0, 293.66],
    [98.0, 123.47, 146.83, 164.81],
  ];
  const sel = k =>
    chords.reduceRight(
      (acc, c, i) =>
        i === chords.length - 1 ? `${c[k]}` : `if(lt(mod(t,${bar * 4}),${bar * (i + 1)}),${c[k]},${acc})`,
      '',
    );
  const env = `pow(sin(PI*mod(t,${bar})/${bar}),0.7)`;
  const voices = [0, 1, 2, 3]
    .map(k => `${[0.32, 0.22, 0.2, 0.12][k]}*sin(2*PI*(${sel(k)})*t)*(1+0.004*sin(2*PI*0.3*t))`)
    .join('+');
  const expr = `(${voices})*${env}*0.5`;
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc=exprs='${expr}|${expr}':s=48000:d=${seconds}`,
    '-af',
    `lowpass=f=1600,aecho=0.8:0.6:120|240:0.35|0.2,volume=0.9,afade=t=in:d=2,afade=t=out:st=${Math.max(0, seconds - 3)}:d=3`,
    '-c:a',
    'pcm_s16le',
    output,
  ]);
}

// ------------------------------------------------------------------ final mix
/**
 * Mix narration, music bed (ducked under the voice) and sfx into one 48 kHz stereo WAV,
 * loudness-normalised (default -16 LUFS integrated, -1.5 dBTP).
 */
export async function mix(root, timing, output, { loudness = -14, voiceGain = 1 } = {}, cues = []) {
  const inputs = [];
  const filters = [];
  const D = timing.duration;
  const add = (file, opts = []) => {
    inputs.push(...opts, '-i', path.isAbsolute(file) ? file : path.join(root, file));
    return inputs.filter(x => x === '-i').length - 1;
  };
  const fmt = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';

  const voLabels = [];
  for (const b of timing.beats) {
    if (!b.vo?.src) continue;
    const i = add(b.vo.src);
    filters.push(`[${i}:a]${fmt},volume=${voiceGain},adelay=${Math.round(b.vo.start * 1000)}:all=1[v${i}]`);
    voLabels.push(`[v${i}]`);
  }
  const sfxLabels = [];
  const allSfx = [
    ...timing.beats.flatMap(b => (b.sfx ?? []).map(s => ({ name: s.src, t: s.t, volume: s.volume }))),
    ...cues.map(c => ({ name: c.name, t: c.t, volume: c.volume })),
  ].filter(s => s.t < D);
  for (const s of allSfx) {
    const file = await resolveCue(root, s.name);
    if (!file) {
      log.warn(`sfx missing: ${s.name} (built-ins: ${Object.keys(SFX).join(', ')})`);
      continue;
    }
    const i = add(file);
    filters.push(`[${i}:a]${fmt},volume=${s.volume},adelay=${Math.round(s.t * 1000)}:all=1[s${i}]`);
    sfxLabels.push(`[s${i}]`);
  }
  const m = timing.music;
  let musicLabel = null;
  if (m?.src) {
    const i = add(m.src, ['-stream_loop', '-1']);
    const off = m.offset ?? 0;
    filters.push(
      `[${i}:a]${fmt},atrim=start=${off}:duration=${D},asetpts=PTS-STARTPTS,volume=${m.volume},afade=t=in:d=${m.fadeIn},afade=t=out:st=${Math.max(0, D - m.fadeOut)}:d=${m.fadeOut}[mus]`,
    );
    musicLabel = '[mus]';
  }
  if (!voLabels.length && !musicLabel && !sfxLabels.length) return null;

  const busses = [];
  if (voLabels.length) {
    filters.push(
      `${voLabels.join('')}amix=inputs=${voLabels.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D}[vo]`,
    );
    if (musicLabel && m.duck) {
      filters.push('[vo]asplit=2[vomix][vokey]');
      filters.push(`${musicLabel}[vokey]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=450:makeup=1[musd]`);
      busses.push('[vomix]', '[musd]');
    } else {
      busses.push('[vo]');
      if (musicLabel) busses.push(musicLabel);
    }
  } else if (musicLabel) busses.push(musicLabel);
  busses.push(...sfxLabels);
  filters.push(
    `${busses.join('')}amix=inputs=${busses.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D},atrim=0:${D},loudnorm=I=${loudness}:TP=-1.5:LRA=11,aresample=48000[out]`,
  );

  await ffmpeg([
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-ac',
    '2',
    '-c:a',
    'pcm_s16le',
    output,
  ]);
  return output;
}

/** Mux silent video + mixed audio into the deliverable. */
export async function mux(video, audio, output) {
  if (!audio) {
    fs.copyFileSync(video, output);
    return output;
  }
  await ffmpeg([
    '-y',
    '-i',
    video,
    '-i',
    audio,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    // Pad the audio so the video is always the shorter stream: -shortest then never drops
    // the last frames when the encoded audio ends a few milliseconds early.
    '-af',
    'apad',
    '-shortest',
    '-movflags',
    '+faststart',
    output,
  ]);
  return output;
}
