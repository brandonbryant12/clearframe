// The final mix: narration, the music bed (ducked under the voice), designed sounds and room
// tone in one 48 kHz stereo WAV, mastered to a loudness target.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { MixSettings, MusicTiming, Timing } from '../domain.mjs';
import { resolveCue, SFX } from './sfx.mjs';
import { ffmpeg, log } from './util.mjs';

/** A designed sound placed in the film: a built-in cue name or project file, film second, gain. */
export interface MixCue {
  name: string;
  t: number;
  volume: number;
}
/** What the mix reads from a timeline. */
export type MixTiming = Pick<Timing, 'duration' | 'beats' | 'music'>;

const FMT = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';

/** The ffmpeg inputs and filter graph of a mix as it is built. */
class MixGraph {
  readonly inputs: string[] = [];
  readonly filters: string[] = [];
  readonly root: string;
  private count = 0;
  constructor(root: string) {
    this.root = root;
  }
  /** Add an input file (relative to the project) and return its input index. */
  add(file: string, opts: readonly string[] = []): number {
    this.inputs.push(
      ...opts,
      '-i',
      path.isAbsolute(file) ? file : path.join(this.root, file),
    );
    return this.count++;
  }
}

/** Each narration take, placed at its film second. */
function voiceLabels(
  graph: MixGraph,
  timing: MixTiming,
  voiceGain: number,
): string[] {
  const labels: string[] = [];
  for (const b of timing.beats) {
    if (!b.vo?.src) continue;
    const i = graph.add(b.vo.src);
    graph.filters.push(
      `[${i}:a]${FMT},volume=${voiceGain},adelay=${Math.round(b.vo.start * 1000)}:all=1[v${i}]`,
    );
    labels.push(`[v${i}]`);
  }
  return labels;
}

/** Every designed sound inside the film: the beats' own and the film's cues. */
async function sfxLabels(
  graph: MixGraph,
  timing: MixTiming,
  cues: readonly MixCue[],
): Promise<string[]> {
  const labels: string[] = [];
  const all: MixCue[] = [
    ...timing.beats.flatMap((b) =>
      (b.sfx ?? []).map((s) => ({ name: s.src, t: s.t, volume: s.volume })),
    ),
    ...cues.map((c) => ({ name: c.name, t: c.t, volume: c.volume })),
  ].filter((s) => s.t < timing.duration);
  for (const s of all) {
    const file = await resolveCue(graph.root, s.name);
    if (!file) {
      log.warn(
        `sfx missing: ${s.name} (built-ins: ${Object.keys(SFX).join(', ')}; a file must be inside the project)`,
      );
      continue;
    }
    const i = graph.add(file);
    graph.filters.push(
      `[${i}:a]${FMT},volume=${s.volume},adelay=${Math.round(s.t * 1000)}:all=1[s${i}]`,
    );
    labels.push(`[s${i}]`);
  }
  return labels;
}

/** The bed, looped and trimmed to the film, faded, and gated to nothing through silent beats. */
function musicLabel(
  graph: MixGraph,
  timing: MixTiming,
  m: MusicTiming & { src: string },
): string {
  const D = timing.duration;
  const i = graph.add(m.src, ['-stream_loop', '-1']);
  // A song placed later than the film's start (its drop lands after the song's own drop
  // time) waits in silence: delay it instead of trimming.
  const off = Math.max(0, m.offset ?? 0),
    wait = Math.max(0, -(m.offset ?? 0));
  // Silent beats are silent: any bed (composed or draft) dips to nothing through them,
  // with 60 ms ramps so the cut to silence never clicks.
  const gate = timing.beats
    .filter((b) => !m.scored && !b.vo && b.dur >= 0.8)
    .map(
      (b) =>
        `(1-clip((t-${(b.start - 0.06).toFixed(3)})/0.06,0,1)*clip((${(b.end + 0.06).toFixed(3)}-t)/0.06,0,1))`,
    )
    .join('*');
  const delay = wait ? `,adelay=${Math.round(wait * 1000)}:all=1` : '';
  const gated = gate ? `,volume='${gate}':eval=frame` : '';
  graph.filters.push(
    `[${i}:a]${FMT},atrim=start=${off}:duration=${Math.max(0.1, D - wait)},asetpts=PTS-STARTPTS,volume=${m.volume},afade=t=in:d=${m.fadeIn}${delay},afade=t=out:st=${Math.max(0, D - m.fadeOut)}:d=${m.fadeOut}${gated}[mus]`,
  );
  return '[mus]';
}

/** The busses summed into the mix: the voice (with the bed ducked under it), the bed, the sounds. */
function busLabels(
  graph: MixGraph,
  D: number,
  voice: readonly string[],
  music: string | null,
  duck: boolean,
): string[] {
  if (!voice.length) return music ? [music] : [];
  graph.filters.push(
    `${voice.join('')}amix=inputs=${voice.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D}[vo]`,
  );
  if (!music) return ['[vo]'];
  if (!duck) return ['[vo]', music];
  graph.filters.push('[vo]asplit=2[vomix][vokey]');
  graph.filters.push(
    `${music}[vokey]sidechaincompress=threshold=0.03:ratio=5:attack=40:release=450:makeup=1[musd]`,
  );
  return ['[vomix]', '[musd]'];
}

/** Integrated loudness (EBU R128, the meter `qa` reads). ebur128 measures at the file's own rate;
 *  loudnorm's analysis upsampled to 192 kHz and took 1.6 s a pass on a 50 s film, most of a draft's mix. */
function integrated(file: string): number {
  const probe = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      file,
      '-af',
      'ebur128=framelog=quiet',
      '-f',
      'null',
      '-',
    ],
    {
      encoding: 'utf8',
    },
  ).stderr;
  const all = [...probe.matchAll(/I:\s+(-?[\d.]+) LUFS/g)];
  return all.length ? Number(all[all.length - 1][1]) : NaN;
}

/**
 * Mastered as an engineer would: one gain to the target, then a peak limiter for the few
 * hits that would cross the ceiling. (loudnorm's linear mode silently falls back to its
 * compressor when the gain would cross the ceiling, and flattens the film again.) A peaky
 * mix (a kick-led bed, hits) loses loudness in the limiter, so the result is measured and
 * the gain corrected, up to three passes, until it sits within half a unit of the target.
 * A mix with nothing above the gate (ebur128 reads -70) keeps its level rather than gaining 56 dB.
 */
async function master(
  pre: string,
  output: string,
  loudness: number,
): Promise<void> {
  const measured = integrated(pre);
  let gain =
    Number.isFinite(measured) && measured > -69 ? loudness - measured : 0;
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
    const after = integrated(output),
      short = loudness - after;
    if (!Number.isFinite(after) || after <= -69 || Math.abs(short) <= 0.5)
      break;
    gain += short;
  }
}

/**
 * Mix narration, music bed (ducked under the voice) and sfx into one 48 kHz stereo WAV,
 * loudness-normalised (default -16 LUFS integrated, -1.5 dBTP).
 */
export async function mix(
  root: string,
  timing: MixTiming,
  output: string,
  { loudness = -14, voiceGain = 1 }: Partial<MixSettings> = {},
  cues: readonly MixCue[] = [],
): Promise<string | null> {
  const graph = new MixGraph(root);
  const D = timing.duration;
  const voice = voiceLabels(graph, timing, voiceGain);
  const sounds = await sfxLabels(graph, timing, cues);
  const m = timing.music;
  const music = m?.src ? musicLabel(graph, timing, { ...m, src: m.src }) : null;
  if (!voice.length && !music && !sounds.length) return null;

  const busses = [
    ...busLabels(graph, D, voice, music, Boolean(m?.duck)),
    ...sounds,
  ];
  // Room tone: a breath of pink noise about 60 dB down, so a silent beat is a held breath in
  // the room, never a digital dropout. Seed it so repeated exports share the same mix.
  graph.filters.push(
    `anoisesrc=d=${D}:c=pink:r=48000:a=0.0012:seed=1,aformat=sample_fmts=fltp:channel_layouts=stereo,lowpass=f=6000[room]`,
  );
  busses.push('[room]');
  graph.filters.push(
    `${busses.join('')}amix=inputs=${busses.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D},atrim=0:${D},aresample=48000[out]`,
  );

  // Two passes: measure the mix, then one linear gain to the target. Single-pass loudnorm is
  // a compressor that lifts quiet passages toward the target, so a silence before the title
  // would come back as a murmur; linear normalisation keeps the drop.
  const pre = `${output}.pre.wav`;
  try {
    await ffmpeg([
      '-y',
      ...graph.inputs,
      '-filter_complex',
      graph.filters.join(';'),
      '-map',
      '[out]',
      '-ac',
      '2',
      '-c:a',
      'pcm_f32le',
      pre,
    ]);
    await master(pre, output, loudness);
  } finally {
    fs.rmSync(pre, { force: true });
  }
  return output;
}
