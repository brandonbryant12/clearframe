import type {
  SoundState,
  SoundBeat,
  SoundTake,
  SoundBasis,
} from './sound-contracts.mjs';
export type {
  SoundState,
  SoundBeat,
  SoundTake,
  SoundBasis,
} from './sound-contracts.mjs';
// The film's sound as the studio shows it: narration takes and music bed, which provider made each
// (free local draft, Google, an imported recording), whether it still matches the storyboard, what
// a Google generation would cost, and whether this computer can make one. Built on the engine's own
// generation paths (engine/lib/generate.mjs); nothing here generates or spends.
//
// Providers are adapters with one shape ({ id, name, kind, paid, ready, needs, models }). Google is
// the first paid adapter for both speech (Gemini TTS) and music (Lyria); the local adapters are the
// free drafts the engine always had.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadStoryboard, paths } from '../project.mjs';
import { computeTiming, estimateDuration } from '../timing.mjs';
import { readJSON } from '../util.mjs';
import { planTakes } from '../takes.mjs';
import { findMusicBed } from '../music-files.mjs';
import { plan, approvedSoundSpecs } from '../generate.mjs';
import { narrationOf } from './studio.mjs';
import * as tts from '../../../skills/gemini-tts/scripts/tts.mjs';
import * as lyria from '../../../skills/lyria-music/scripts/music.mjs';
import { decodeStoryboard, decodeVoiceMetadata } from '../../schemas.mjs';
import type { Timing, VoiceMetadata } from '../../domain.mjs';
import {
  errorMessage,
  isRecord,
  type SoundKind,
} from '../harness/contracts.mjs';
import { readSchema } from './media.mjs';
import { BedSchema } from './schemas.mjs';
const googleReady = () => !!process.env.GEMINI_API_KEY;
export function providers(): SoundState['providers'] {
  const google = {
    ready: googleReady(),
    needs: googleReady()
      ? null
      : 'Set GEMINI_API_KEY in the environment that starts the studio (see docs/agent-studio.md, “Google sound”), then restart it.',
  };
  return {
    speech: [
      {
        id: 'local',
        name: 'Free draft voice (this computer)',
        paid: false,
        ready: true,
        needs: null,
        note: 'Operating-system voice, for rough cuts. Never replaces a Google take whose words are unchanged.',
      },
      {
        id: 'google',
        name: 'Google Gemini TTS',
        paid: true,
        ...google,
        models: Object.keys(tts.MODELS),
        note: 'One continuous take per film (or chapter), cut back into scenes. Cached by words, voice, style and model.',
      },
    ],
    music: [
      {
        id: 'local',
        name: 'Free draft bed (this computer)',
        paid: false,
        ready: true,
        needs: null,
        note: 'A soft synthesized pad; never replaces a Google bed unless you choose to.',
      },
      {
        id: 'google',
        name: 'Google Lyria',
        paid: true,
        ...google,
        models: Object.entries(lyria.MODELS).map(([id, m]) => ({
          id,
          price: m.price,
          note: m.note,
        })),
        note: 'One instrumental bed shaped to the edit. Regenerating replaces the current bed.',
      },
    ],
  };
}

const url = (base: string, file: string) =>
  '/' +
  path.relative(base, file).split(path.sep).map(encodeURIComponent).join('/');
const voiceLabel = (m: VoiceMetadata | null) => {
  if (!m) return null;
  return m.provider === 'local'
    ? (m.osVoice ?? 'unrecorded OS voice')
    : (m.voice ?? null);
};
const takeStatus = (beats: SoundBeat[]) => {
  if (beats.every((b) => b.current)) return 'google';
  if (beats.some((b) => b.made === 'gemini' && !b.current))
    return 'google-changed';
  if (beats.every((b) => b.made === 'local')) return 'draft';
  return beats.some((b) => b.made) ? 'partial' : 'none';
};
const voiceOf = (
  P: ReturnType<typeof paths>,
  id: string,
): VoiceMetadata | null => {
  try {
    return decodeVoiceMetadata(readJSON(path.join(P.vo, `${id}.json`), null));
  } catch {
    return null;
  }
};

/** A film's sound (narration, music, what Google would cost), for the agent and approvals. `base` is the folder the studio serves. */
export function soundState(dir: string, base = process.cwd()): SoundState {
  const sb = loadStoryboard(dir),
    P = paths(dir);
  let timing: Timing | null = null,
    costs: ReturnType<typeof plan> | null = null,
    planError: string | null = null;
  try {
    timing = computeTiming(dir);
  } catch {}
  try {
    costs = plan(dir);
  } catch (e) {
    planError = errorMessage(e);
  }
  const row = (kind: string, id: string) =>
    costs?.rows.find((r) => r.kind === kind && r.id === id) ?? null;
  const raw = decodeStoryboard(
    JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')),
  );
  const recorded = raw.beats.some(
    (b) => narrationOf(dir, b).kind === 'recording',
  );
  const takes: SoundTake[] = recorded
    ? []
    : planTakes(sb).map((t) => {
        const beats = t.beats.map((b) => {
          const m = voiceOf(P, b.id),
            wav = path.join(P.vo, `${b.id}.wav`),
            r = row('voice', b.id);
          return {
            id: b.id,
            words: (b.vo ?? '').split(/\s+/).length,
            seconds:
              Math.round(estimateDuration(b.vo ?? '', sb.voice.wpm) * 10) / 10,
            // What spoke the line, from its own record: a draft is the OS voice it noted (older drafts noted
            // only the Google setting, so their voice is unknown), never today's settings.
            made: m?.provider ?? null,
            model: m?.model ?? null,
            voice: voiceLabel(m),
            at: m?.createdAt ?? null,
            audio: fs.existsSync(wav) ? url(base, wav) : null,
            current: r?.status === 'cached',
            draftOnly: r?.status === 'draft only',
            cost: r?.cost ?? 0,
            measured: m?.alignment?.kind === 'measured',
          };
        });
        return {
          id: t.id,
          beats,
          seconds:
            Math.round(beats.reduce((n, b) => n + b.seconds, 0) * 10) / 10,
          cost: beats.reduce((n, b) => n + b.cost, 0),
          status: takeStatus(beats),
        };
      });
  const bedMeta = readSchema(path.join(P.music, 'bed.json'), BedSchema, {}),
    bed = sb.music ? findMusicBed(dir, bedMeta) : null,
    mrow = row('music', 'bed');
  const out: SoundState = {
    providers: providers(),
    narration: {
      recorded,
      provider: sb.voice.provider,
      model: sb.voice.model,
      voice: sb.voice.voice,
      style: sb.voice.style ?? '',
      takesMode: sb.voice.takes ?? 'film',
      voices: Object.entries(tts.VOICES ?? {}).map(([id, v]) => ({
        id,
        character: String(v),
      })),
      lines: raw.beats.filter((b) => b.vo).length,
      takes,
      cost: takes.reduce((n, t) => n + t.cost, 0),
    },
    music:
      sb.music === false
        ? { off: true }
        : {
            off: false,
            model: sb.music.model ?? 'lyria-3.5',
            prompt: sb.music.prompt ?? '',
            bpm: sb.music.bpm ?? null,
            volume: sb.music.volume,
            duck: sb.music.duck,
            fadeIn: sb.music.fadeIn,
            fadeOut: sb.music.fadeOut,
            made: bed ? (bedMeta?.provider ?? 'file') : null,
            at: bedMeta?.createdAt ?? null,
            audio: bed ? url(base, path.join(dir, bed)) : null,
            current: mrow?.status === 'cached',
            cost: mrow?.cost ?? 0,
            seconds: timing ? Math.ceil(timing.duration + 2) : null,
          },
    sfx: raw.sfx ?? 'off',
    budget: raw.budget ?? null,
    plan: costs
      ? { total: costs.total, rows: costs.rows, duration: costs.duration }
      : null,
    planError,
  };
  out.basis = {
    voice: out.narration.recorded ? null : basisOf(dir, 'voice', out),
    music: out.music.off ? null : basisOf(dir, 'music', out),
  };
  return out;
}

/**
 * Exactly what a person is shown when approving a generation: the working copy, the settings that
 * shape the result, and the estimate. An approval is bound to it; if anything changed since the
 * dialog opened, the approval is refused and the person reviews again.
 */
export function basisOf(
  dir: string,
  kind: SoundKind,
  s: SoundState = soundState(dir),
): SoundBasis {
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(dir, 'storyboard.json')))
    .digest('hex')
    .slice(0, 16);
  const musicCost = s.music.off ? 0 : s.music.cost;
  const cost =
    Math.round((kind === 'voice' ? s.narration.cost : musicCost) * 1e6) / 1e6;
  // The exact provider requests (content hashes) this approval covers; the run refuses any others.
  let specs: string[] = [];
  try {
    specs = approvedSoundSpecs(dir, kind);
  } catch {}
  if (kind === 'music' && s.music.off)
    throw new Error('Music is off for this film.');
  const music = s.music.off ? null : s.music;
  return kind === 'voice'
    ? {
        kind,
        hash,
        model: s.narration.model,
        voice: s.narration.voice,
        style: s.narration.style,
        takes: (s.narration.takes ?? [])
          .filter((t) => t.cost > 0)
          .map((t) => t.id),
        cost,
        specs,
      }
    : {
        kind,
        hash,
        model: music?.model,
        prompt: music?.prompt,
        bpm: music?.bpm,
        cost,
        specs,
      };
}
export const sameBasis = (a: unknown, b: SoundBasis | null | undefined) =>
  isRecord(a) &&
  !!b &&
  JSON.stringify(
    Object.keys(b)
      .sort()
      .map((k) => [k, a[k]]),
  ) ===
    JSON.stringify(Object.entries(b).sort(([a], [b]) => a.localeCompare(b)));

/**
 * What a Google generation of `kind` would cost now. Approval is checked against this, and the
 * same amount is passed to the engine as its budget, so an estimate that grew is refused there too.
 */
export function estimate(dir: string, kind: SoundKind) {
  const s = soundState(dir);
  if (kind === 'voice') {
    if (s.narration.recorded)
      throw Object.assign(
        new Error(
          'This film’s narration is the recording itself; it is edited by cutting words, not regenerated.',
        ),
        { status: 409 },
      );
    if (!s.narration.lines)
      throw Object.assign(new Error('There is no narration to record.'), {
        status: 409,
      });
    return {
      cost: s.narration.cost,
      takes: s.narration.takes.filter((t) => t.cost > 0).map((t) => t.id),
      detail: `${s.narration.takes.filter((t) => t.cost > 0).length} take(s) changed or new`,
    };
  }
  if (kind === 'music') {
    if (s.music.off)
      throw Object.assign(new Error('Music is off for this film.'), {
        status: 409,
      });
    return {
      cost: s.music.cost,
      detail: `${s.music.seconds ?? '?'} s bed with ${s.music.model}`,
    };
  }
  throw Object.assign(new Error('Choose narration or music.'), { status: 400 });
}
