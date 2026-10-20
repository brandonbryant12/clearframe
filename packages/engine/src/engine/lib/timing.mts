// Voice-first timing. Every scene's length comes from the narration it carries,
// plus a lead-in (visual lands before the voice) and a tail (let it breathe).
import fs from 'node:fs';
import path from 'node:path';
import type {
  Asset,
  Beat,
  MusicSettings,
  MusicTiming,
  ResolvedStoryboard,
  TimedBeat,
  TimedVoice,
  Timing,
} from '../domain.mjs';
import { loadStoryboard } from './project.mjs';
import { round, snap } from './util.mjs';
import { findMusicBed } from './music-files.mjs';
import { blockByName } from '../../film/catalog.mjs';
import { planTakes } from './takes.mjs';
import { COVER } from '../../film/constants.mjs';
import { analyseTrack } from './beatmap.mjs';
import { readUntil, resolveAt } from './timing-cues.mjs';
import { voiceFor } from './timing-narration.mjs';
import type { Narration, TakePosition } from './timing-narration.mjs';

export type { Token } from './timing-speech.mjs';
export {
  alignWords,
  distributeWords,
  estimateDuration,
  syllables,
  tokenize,
} from './timing-speech.mjs';
export type { CueBeat } from './timing-cues.mjs';
export { findWord, resolveAt } from './timing-cues.mjs';
export type {
  CaptionCue,
  CaptionText,
  CaptionTiming,
} from './timing-captions.mjs';
export { captionCues, captionLines, toSRT, toVTT } from './timing-captions.mjs';

/** Recommended reading hold from the native catalog. */
export function blockTail(name: string): number | null {
  const tail = blockByName(name)?.tail;
  return typeof tail === 'number' ? tail : null;
}

const catalogTail = (block: string | undefined): number | null =>
  block ? blockTail(block) : null;

/** Before any audio exists, time the beats the way their planned continuous takes will
 *  play: back to back inside a take, with lead and tail only at its ends. */
function plannedTakes(sb: ResolvedStoryboard): Map<string, TakePosition> {
  const planned = new Map<string, TakePosition>();
  for (const t of planTakes(sb))
    t.beats.forEach((b, i) =>
      planned.set(b.id, { index: i, count: t.beats.length }),
    );
  return planned;
}

/** The silence a beat leaves around its narration. */
interface BeatPace {
  lead: number;
  tail: number;
  continuousLead: boolean;
  continuousTail: boolean;
}

/** The hold after a beat's last word: a graphic transition marks a turn, so the voice takes a
 *  breath there and the outgoing scene has time to cover the cut (take slices are separate
 *  files); type that builds with the voice holds its finished line a moment before the cut, so
 *  the last word is read, not just heard. */
function breathBefore(sb: ResolvedStoryboard, index: number): number {
  if (sb.pacing.continuous === true) return 0;
  const b = sb.beats[index];
  const next: Beat | undefined = sb.beats[index + 1];
  const into = next ? (next.transition ?? sb.transition) : undefined;
  const cover: readonly [number, number] | undefined =
    into === undefined ? undefined : COVER[into];
  const reads = b.block === 'kinetic' || b.block === 'statement' ? 0.5 : 0;
  return Math.max(cover ? cover[0] + 0.1 : 0, reads);
}

function beatPace(
  sb: ResolvedStoryboard,
  index: number,
  take: TakePosition | undefined,
): BeatPace {
  const b = sb.beats[index];
  // A continuous recording (imported podcast or talk) plays back to back: no added lead or tail.
  // Continuous takes play back to back: no lead inside a take, no tail until its last beat.
  const recording = sb.pacing.continuous === true && !!b.vo;
  const continuousLead = recording || (!!take && take.index > 0);
  const continuousTail = recording || (!!take && take.index < take.count - 1);
  const breath = breathBefore(sb, index);
  const authoredTail = continuousTail
    ? breath
    : Math.max(breath, catalogTail(b.block) ?? sb.pacing.tail);
  return {
    lead: b.lead ?? (continuousLead ? 0 : sb.pacing.lead),
    tail: b.tail ?? authoredTail,
    continuousLead,
    continuousTail,
  };
}

function beatDuration(
  sb: ResolvedStoryboard,
  b: Beat,
  vo: Narration | null,
  pace: BeatPace,
): number {
  if (b.duration !== undefined) return b.duration;
  const lead = Math.max(0, pace.lead);
  let natural = vo
    ? lead + vo.duration + pace.tail + (b.hold ?? 0)
    : sb.pacing.silentBeat + (b.hold ?? 0);
  // Words cued to the narration must stay up long enough to be read: a note on the last
  // spoken word would otherwise flash for a fraction of a second before the cut.
  // Not inside an imported recording, though: its next slice follows straight on, and stretching
  // this one would insert silence into the conversation (7 s in one podcast). A voice take may
  // pause for its picture.
  if (vo && !(pace.continuousTail && vo.provider === 'imported'))
    natural = Math.max(natural, lead + readUntil(b, vo.words));
  // Stretching a slice of a continuous recording would insert silence into it.
  return pace.continuousLead || pace.continuousTail
    ? natural
    : Math.max(b.min ?? sb.pacing.minBeat, natural);
}

function timedVoice(
  text: string,
  vo: Narration,
  start: number,
  lead: number,
): TimedVoice {
  const voStart = round(Math.max(0, start + lead));
  return {
    text,
    src: vo.src,
    start: voStart,
    end: round(voStart + vo.duration),
    dur: round(vo.duration),
    estimated: vo.estimated,
    provider: vo.provider ?? null,
    wordTiming: vo.wordTiming ?? 'estimated',
    ...(vo.alignmentIssue ? { alignmentIssue: vo.alignmentIssue } : {}),
    ...(vo.stale ? { stale: vo.stale } : {}),
    words: vo.words.map((w) => ({
      w: w.w,
      t0: round(voStart + w.t0),
      t1: round(voStart + w.t1),
    })),
  };
}

function timeBeats(root: string, sb: ResolvedStoryboard): TimedBeat[] {
  const { fps } = sb.format;
  const planned = plannedTakes(sb);
  const beats: TimedBeat[] = [];
  let cursor = 0;
  for (const [index, b] of sb.beats.entries()) {
    const vo = b.vo ? voiceFor(root, b.id, b.vo, sb.voice.wpm) : null;
    const take = vo?.take ?? (vo?.estimated ? planned.get(b.id) : undefined);
    const pace = beatPace(sb, index, take);
    const dur = beatDuration(sb, b, vo, pace);
    const start = snap(cursor, fps);
    const end = snap(cursor + dur, fps);
    const beat: TimedBeat = {
      id: b.id,
      index,
      chapter: b.chapter ?? null,
      scene: b.scene ?? null,
      block: b.block ?? null,
      props: b.props ?? null,
      transition: b.transition ?? null,
      start,
      end,
      dur: round(end - start),
      visual: b.visual ?? null,
    };
    if (vo && b.vo) beat.vo = timedVoice(b.vo, vo, start, pace.lead);
    if (b.sfx)
      beat.sfx = b.sfx.map((s) => ({
        src: s.src,
        volume: s.volume ?? 0.6,
        t: resolveAt(s.at ?? 0, beat),
      }));
    beats.push(beat);
    cursor = end;
  }
  return beats;
}

/** Compute the full timeline for a project. Pure file reads; cheap enough to run per request. */
export function computeTiming(
  root: string,
  { storyboard }: { storyboard?: Parameters<typeof loadStoryboard>[1] } = {},
): Timing {
  const sb: ResolvedStoryboard = loadStoryboard(root, storyboard);
  const { fps, width, height } = sb.format;
  const beats = timeBeats(root, sb);
  const cursor = beats.length ? beats[beats.length - 1].end : 0;
  const duration = round(cursor + (sb.pacing.outro ?? 0));
  const music =
    sb.music && sb.music.file !== false
      ? musicInfo(root, sb.music, beats)
      : null;
  return {
    title: sb.title ?? 'Untitled',
    width,
    height,
    fps,
    duration,
    frames: Math.round(duration * fps),
    theme: sb.theme ?? 'paper',
    // Recorded for reference; the native job (film/production.mjs) is authoritative.
    look: {
      backdrop: sb.backdrop ?? 'none',
      chrome: sb.chrome === true,
      captions: sb.captions ?? 'auto',
      transition: sb.transition ?? 'cut',
      sfx: sb.sfx ?? false,
      voiceProvider: sb.voice.provider,
    },
    estimated: beats.some((b) => b.vo?.estimated),
    beats,
    music,
    assets: sb.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      src: assetSrc(root, a),
    })),
  };
}

function musicInfo(
  root: string,
  plan: MusicSettings,
  beats: readonly TimedBeat[],
): MusicTiming {
  const candidates = [plan.file, findMusicBed(root)].filter(
    (f): f is string => typeof f === 'string' && f !== '',
  );
  const src = candidates.find((f) => fs.existsSync(path.join(root, f))) ?? null;
  const info: MusicTiming = {
    src,
    volume: plan.volume,
    duck: plan.duck,
    fadeIn: plan.fadeIn,
    fadeOut: plan.fadeOut,
    offset: plan.offset ?? 0,
    // A bed scored to an explicit arc keeps playing under voiceless beats.
    scored: Boolean(plan.arc || plan.sections),
  };
  // The drop lands on the key picture: the song starts so that its drop (measured, or given in
  // song seconds) plays at a beat's start or a cue in it. A negative offset delays the song.
  const d = plan.drop;
  if (d && src) {
    const beat = beats.find((b) => b.id === d.beat);
    if (!beat) throw new Error(`music.drop.beat "${d.beat}" is not a beat id`);
    const song =
      d.song == null || d.song === 'auto'
        ? analyseTrack(path.join(root, src)).drop?.t
        : d.song;
    if (song == null)
      throw new Error(
        `No drop measured in ${src}; give music.drop.song in seconds.`,
      );
    const film = resolveAt(d.at ?? 0, beat);
    info.offset = round(song - film);
    info.drop = { beat: beat.id, film, song };
  }
  return info;
}

/** Where an asset kind's generated files live, and the extensions they may have. */
const ASSET_DIRS = new Map<string, { dir: string; exts: readonly string[] }>([
  ['image', { dir: 'assets/img', exts: ['jpg', 'png', 'webp'] }],
  ['clip', { dir: 'assets/clips', exts: ['mp4', 'webm'] }],
]);
const SFX_DIR = { dir: 'assets/sfx', exts: ['wav', 'mp3'] };

export function assetSrc(
  root: string,
  a: Pick<Asset, 'id' | 'kind' | 'file'>,
): string | null {
  if (a.file) return a.file;
  const { dir, exts } = ASSET_DIRS.get(a.kind) ?? SFX_DIR;
  for (const ext of exts) {
    const rel = `${dir}/${a.id}.${ext}`;
    if (fs.existsSync(path.join(root, rel))) return rel;
  }
  return null;
}
