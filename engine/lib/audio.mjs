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
/**
 * Text as the OS voice should read it: macOS `say` reads "the button: not Attach" as "button colon"
 * and skips an arrow, so a colon before a word and an arrow become a pause. The words are unchanged,
 * so their timings still match the narration.
 */
export const forOsVoice = (text, pronounce = {}) => {
  let t = String(text);
  // `voice.pronounce` respells words the OS voice says wrong ("Alder": "All-der"); the narration,
  // its captions and its word timings keep the written word.
  for (const [word, said] of Object.entries(pronounce ?? {}))
    if (word && typeof said === 'string') t = t.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), said);
  return t.replace(/(\S):(?=\s)/g, '$1,').replace(/\s*(→|->|=>)\s*/g, ', ');
};
/** Draft narration with the OS voice (macOS `say`, Linux `espeak-ng`/`espeak`). For timing only. */
export async function draftVoice(text, output, { wpm = 150, voice, pronounce } = {}) {
  const mac = process.platform === 'darwin';
  const pauses = { 'short pause': 350, 'long pause': 800, breath: 250, sigh: 400 };
  const spoken = forOsVoice(text, pronounce)
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

/** Draft music bed: a soft, slow chord pad, synthesised by ffmpeg. */
export async function draftMusic(output, { seconds = 60, bpm = 72, style = 'pad' } = {}) {
  // The trailer `pulse` bed (a kick building to a silence that cuts dead) was retired with cinema.
  if (style !== 'pad') throw new Error(`music.style "${style}" was retired: the draft bed is a calm pad; brief a composed bed (Lyria) for anything else`);
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
  // abs(): rounding can push the sine a hair below zero, and pow() of a negative is NaN, which
  // would poison the lowpass and echo state for the rest of the bed (a full-scale DC wall).
  const env = `pow(abs(sin(PI*mod(t,${bar})/${bar})),0.7)`;
  const voices = [0, 1, 2, 3]
    .map(k => `${[0.32, 0.22, 0.2, 0.12][k]}*sin(2*PI*(${sel(k)})*t)*(1+0.004*sin(2*PI*0.3*t))`)
    .join('+');
  // A bed in sections, not a static pad: it starts sparse, builds toward the last third of the
  // film, then settles under the ending.
  const arc = `(0.55+0.45*min(1,t/${(seconds * 0.7).toFixed(2)}))*(1-0.35*clip((t-${(seconds * 0.85).toFixed(2)})/${(seconds * 0.15).toFixed(2)},0,1))`;
  const expr = `(${voices})*${env}*${arc}*0.5`;
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
    // A song placed later than the film's start (its drop lands after the song's own drop
    // time) waits in silence: delay it instead of trimming.
    const off = Math.max(0, m.offset ?? 0),
      wait = Math.max(0, -(m.offset ?? 0));
    // Silent beats are silent: any bed (composed or draft) dips to nothing through them,
    // with 60 ms ramps so the cut to silence never clicks.
    const gate = timing.beats
      .filter(b => !m.scored && !b.vo && b.dur >= 0.8)
      .map(b => `(1-clip((t-${(b.start - 0.06).toFixed(3)})/0.06,0,1)*clip((${(b.end + 0.06).toFixed(3)}-t)/0.06,0,1))`)
      .join('*');
    filters.push(
      `[${i}:a]${fmt},atrim=start=${off}:duration=${Math.max(0.1, D - wait)},asetpts=PTS-STARTPTS,volume=${m.volume},afade=t=in:d=${m.fadeIn}${wait ? `,adelay=${Math.round(wait * 1000)}:all=1` : ''},afade=t=out:st=${Math.max(0, D - m.fadeOut)}:d=${m.fadeOut}${gate ? `,volume='${gate}':eval=frame` : ''}[mus]`,
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
  // Room tone: a breath of pink noise about 60 dB down, so a silent beat is a held breath in
  // the room, never a digital dropout. Seed it so repeated exports share the same mix.
  filters.push(
    `anoisesrc=d=${D}:c=pink:r=48000:a=0.0012:seed=1,aformat=sample_fmts=fltp:channel_layouts=stereo,lowpass=f=6000[room]`,
  );
  busses.push('[room]');
  filters.push(
    `${busses.join('')}amix=inputs=${busses.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D},atrim=0:${D},aresample=48000[out]`,
  );

  // Two passes: measure the mix, then one linear gain to the target. Single-pass loudnorm is
  // a compressor that lifts quiet passages toward the target, so a silence before the title
  // would come back as a murmur; linear normalisation keeps the drop.
  const pre = `${output}.pre.wav`;
  try {
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
      'pcm_f32le',
      pre,
    ]);
    // Integrated loudness (EBU R128, the meter `qa` reads). ebur128 measures at the file's own rate;
    // loudnorm's analysis upsampled to 192 kHz and took 1.6 s a pass on a 50 s film, most of a draft's mix.
    const integrated = file => {
      const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], {
        encoding: 'utf8',
      }).stderr;
      const all = [...probe.matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
      return all.length ? Number(all.at(-1)[1]) : NaN;
    };
    // Mastered as an engineer would: one gain to the target, then a peak limiter for the few
    // hits that would cross the ceiling. (loudnorm's linear mode silently falls back to its
    // compressor when the gain would cross the ceiling, and flattens the film again.) A peaky
    // mix (a kick-led bed, hits) loses loudness in the limiter, so the result is measured and
    // the gain corrected, up to three passes, until it sits within half a unit of the target.
    // A mix with nothing above the gate (ebur128 reads -70) keeps its level rather than gaining 56 dB.
    const measured = integrated(pre);
    let gain = Number.isFinite(measured) && measured > -69 ? loudness - measured : 0;
    for (let pass = 0; pass < 3; pass++) {
      await ffmpeg([
        '-y',
        '-i',
        pre,
        '-af',
        `volume=${gain.toFixed(2)}dB,alimiter=limit=${(10 ** (-1.8 / 20)).toFixed(3)}:attack=2:release=60:level=false,aresample=48000`,
        '-ac',
        '2',
        '-c:a',
        'pcm_s16le',
        output,
      ]);
      const after = integrated(output), short = loudness - after;
      if (!Number.isFinite(after) || after <= -69 || Math.abs(short) <= 0.5) break;
      gain += short;
    }
  } finally {
    fs.rmSync(pre, { force: true });
  }
  return output;
}

// The native renderer applies a BT.601 limited-range matrix to sRGB picture values;
// it does not convert their transfer curve to BT.709. sRGB shares BT.709 primaries,
// but has its own transfer function (H.264 VUI value 13). Preserve the actual matrix
// and tag the transfer in both the bitstream and container without changing pixels.
const TAGS = [
  '-bsf:v',
  'h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=6:video_full_range_flag=0:sample_aspect_ratio=1/1',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'iec61966-2-1',
  '-colorspace',
  'smpte170m',
  '-color_range',
  'tv',
];

/** Mux native sRGB/BT.601 video + mixed audio into the deliverable. */
/**
 * The mix as AAC, ready to mux by copy: encoded while the renderer draws (the mix depends only on
 * the timing), so muxing is a stream copy. Padded a quarter second past the film so the video is
 * always the shorter stream and `-shortest` never drops a last frame.
 */
export async function encodeAudio(wav, output) {
  await ffmpeg(['-y', '-i', wav, '-af', 'apad=pad_dur=0.25', '-c:a', 'aac', '-b:a', '192k', output]);
  return output;
}

export async function mux(video, audio, output) {
  // Audio already encoded (encodeAudio) is copied; a WAV (a range preview's cut) is encoded here.
  if (audio && /\.(m4a|aac)$/i.test(audio)) {
    await ffmpeg(['-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', ...TAGS, '-c:a', 'copy', '-shortest', '-movflags', '+faststart', output]);
    return output;
  }
  if (!audio) {
    await ffmpeg(['-y', '-i', video, '-map', '0:v:0', '-c:v', 'copy', ...TAGS, '-movflags', '+faststart', output]);
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
    ...TAGS,
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
