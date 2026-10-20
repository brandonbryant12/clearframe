// Audio: voice post-processing + alignment, local draft voice/music, and the final mix.
import { ffmpeg } from './util.mjs';

export type {
  DraftVoiceOptions,
  Pronunciations,
  SpeechSegments,
  VoiceAnalysis,
} from './audio-voice.mjs';
export {
  analyseVoice,
  cleanVoice,
  draftVoice,
  forOsVoice,
  speechSegments,
} from './audio-voice.mjs';
export type { MixCue, MixTiming } from './audio-mix.mjs';
export { mix } from './audio-mix.mjs';

export interface DraftMusicOptions {
  seconds?: number;
  bpm?: number;
  style?: string;
}

/** Draft music bed: a soft, slow chord pad, synthesised by ffmpeg. */
export async function draftMusic(
  output: string,
  { seconds = 60, bpm = 72, style = 'pad' }: DraftMusicOptions = {},
): Promise<void> {
  // The trailer `pulse` bed (a kick building to a silence that cuts dead) was retired with cinema.
  if (style !== 'pad')
    throw new Error(
      `music.style "${style}" was retired: the draft bed is a calm pad; brief a composed bed (Lyria) for anything else`,
    );
  const bar = (60 / bpm) * 4; // one chord per bar
  const chords: readonly (readonly number[])[] = [
    // Am9 · Fmaj7 · C(add9) · G6 — calm, unresolved, professional
    [110.0, 130.81, 164.81, 246.94],
    [87.31, 130.81, 164.81, 220.0],
    [130.81, 164.81, 196.0, 293.66],
    [98.0, 123.47, 146.83, 164.81],
  ];
  const sel = (k: number): string =>
    chords.reduceRight<string>(
      (acc, c, i) =>
        i === chords.length - 1
          ? `${c[k]}`
          : `if(lt(mod(t,${bar * 4}),${bar * (i + 1)}),${c[k]},${acc})`,
      '',
    );
  // abs(): rounding can push the sine a hair below zero, and pow() of a negative is NaN, which
  // would poison the lowpass and echo state for the rest of the bed (a full-scale DC wall).
  const env = `pow(abs(sin(PI*mod(t,${bar})/${bar})),0.7)`;
  const voices = [0, 1, 2, 3]
    .map(
      (k) =>
        `${[0.32, 0.22, 0.2, 0.12][k]}*sin(2*PI*(${sel(k)})*t)*(1+0.004*sin(2*PI*0.3*t))`,
    )
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

/**
 * The mix as AAC, ready to mux by copy: encoded while the renderer draws (the mix depends only on
 * the timing), so muxing is a stream copy. Padded a quarter second past the film so the video is
 * always the shorter stream and `-shortest` never drops a last frame.
 */
export async function encodeAudio(
  wav: string,
  output: string,
): Promise<string> {
  await ffmpeg([
    '-y',
    '-i',
    wav,
    '-af',
    'apad=pad_dur=0.25',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    output,
  ]);
  return output;
}

/** Mux native sRGB/BT.601 video + mixed audio into the deliverable. */
export async function mux(
  video: string,
  audio: string | null | undefined,
  output: string,
): Promise<string> {
  // Audio already encoded (encodeAudio) is copied; a WAV (a range preview's cut) is encoded here.
  if (audio && /\.(m4a|aac)$/i.test(audio)) {
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
      'copy',
      '-shortest',
      '-movflags',
      '+faststart',
      output,
    ]);
    return output;
  }
  if (!audio) {
    await ffmpeg([
      '-y',
      '-i',
      video,
      '-map',
      '0:v:0',
      '-c:v',
      'copy',
      ...TAGS,
      '-movflags',
      '+faststart',
      output,
    ]);
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
