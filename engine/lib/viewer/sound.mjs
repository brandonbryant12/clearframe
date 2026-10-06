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

const googleReady = () => !!process.env.GEMINI_API_KEY;
export function providers() {
  const google = { ready: googleReady(), needs: googleReady() ? null : 'Set GEMINI_API_KEY in the environment that starts the studio (see docs/agent-studio.md, “Google sound”), then restart it.' };
  return {
    speech: [
      { id: 'local', name: 'Free draft voice (this computer)', paid: false, ready: true, needs: null, note: 'Operating-system voice, for rough cuts. Never replaces a Google take whose words are unchanged.' },
      { id: 'google', name: 'Google Gemini TTS', paid: true, ...google, models: Object.keys(tts.MODELS), note: 'One continuous take per film (or chapter), cut back into scenes. Cached by words, voice, style and model.' },
    ],
    music: [
      { id: 'local', name: 'Free draft bed (this computer)', paid: false, ready: true, needs: null, note: 'A soft synthesized pad; never replaces a Google bed unless you choose to.' },
      { id: 'google', name: 'Google Lyria', paid: true, ...google, models: Object.entries(lyria.MODELS).map(([id, m]) => ({ id, price: m.price, note: m.note })), note: 'One instrumental bed shaped to the edit. Regenerating replaces the current bed.' },
    ],
  };
}

const url = (base, file) => '/' + path.relative(base, file).split(path.sep).map(encodeURIComponent).join('/');
const voiceOf = (P, id) => readJSON(path.join(P.vo, `${id}.json`), null);

/** Everything the Sound tab needs, for one film. `base` is the folder the studio serves. */
export function soundState(dir, base = process.cwd()) {
  const sb = loadStoryboard(dir), P = paths(dir);
  let timing = null, costs = null, planError = null;
  try { timing = computeTiming(dir); } catch {}
  try { costs = plan(dir); } catch (e) { planError = e.message; }
  const row = (kind, id) => costs?.rows.find(r => r.kind === kind && r.id === id) ?? null;
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
  const recorded = raw.beats.some(b => narrationOf(dir, b).kind === 'recording');
  const takes = recorded ? [] : planTakes(sb).map(t => {
    const beats = t.beats.map(b => {
      const m = voiceOf(P, b.id), wav = path.join(P.vo, `${b.id}.wav`), r = row('voice', b.id);
      return { id: b.id, words: b.vo.split(/\s+/).length, seconds: Math.round(estimateDuration(b.vo, sb.voice.wpm) * 10) / 10,
        // What spoke the line, from its own record: a draft is the OS voice it noted (older drafts noted
        // only the Google setting, so their voice is unknown), never today's settings.
        made: m?.provider ?? null, model: m?.model ?? null, voice: m ? (m.provider === 'local' ? m.osVoice ?? 'unrecorded OS voice' : m.voice ?? null) : null, at: m?.createdAt ?? null, audio: fs.existsSync(wav) ? url(base, wav) : null,
        current: r?.status === 'cached', draftOnly: r?.status === 'draft only', cost: r?.cost ?? 0, measured: m?.alignment?.kind === 'measured' };
    });
    const google = beats.every(b => b.current), stale = beats.some(b => b.made === 'gemini' && !b.current);
    return { id: t.id, beats, seconds: Math.round(beats.reduce((n, b) => n + b.seconds, 0) * 10) / 10, cost: beats.reduce((n, b) => n + b.cost, 0),
      status: google ? 'google' : stale ? 'google-changed' : beats.every(b => b.made === 'local') ? 'draft' : beats.some(b => b.made) ? 'partial' : 'none' };
  });
  const bedMeta = readJSON(path.join(P.music, 'bed.json'), null), bed = sb.music ? findMusicBed(dir, bedMeta) : null, mrow = row('music', 'bed');
  const out = {
    providers: providers(),
    narration: {
      recorded, provider: sb.voice.provider, model: sb.voice.model, voice: sb.voice.voice, style: sb.voice.style ?? '', takesMode: sb.voice.takes ?? 'film',
      voices: Object.entries(tts.VOICES ?? {}).map(([id, v]) => ({ id, character: typeof v === 'string' ? v : v?.character ?? v?.tone ?? '' })),
      lines: raw.beats.filter(b => b.vo).length, takes,
      cost: takes.reduce((n, t) => n + t.cost, 0),
    },
    music: sb.music === false ? { off: true } : {
      off: false, model: sb.music.model ?? 'lyria-3.5', prompt: sb.music.prompt ?? '', bpm: sb.music.bpm ?? null, volume: sb.music.volume, duck: sb.music.duck, fadeIn: sb.music.fadeIn, fadeOut: sb.music.fadeOut,
      made: bed ? bedMeta?.provider ?? 'file' : null, at: bedMeta?.createdAt ?? null, audio: bed ? url(base, path.join(dir, bed)) : null,
      current: mrow?.status === 'cached', cost: mrow?.cost ?? 0, seconds: timing ? Math.ceil(timing.duration + 2) : null,
    },
    sfx: raw.sfx ?? 'off', budget: raw.budget ?? null,
    plan: costs ? { total: costs.total, rows: costs.rows, duration: costs.duration } : null, planError,
  };
  out.basis = { voice: out.narration.recorded ? null : basisOf(dir, 'voice', out), music: out.music.off ? null : basisOf(dir, 'music', out) };
  return out;
}

/**
 * Exactly what a person is shown when approving a generation: the working copy, the settings that
 * shape the result, and the estimate. An approval is bound to it; if anything changed since the
 * dialog opened, the approval is refused and the person reviews again.
 */
export function basisOf(dir, kind, s = soundState(dir)) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'storyboard.json'))).digest('hex').slice(0, 16);
  const cost = Math.round((kind === 'voice' ? s.narration.cost ?? 0 : s.music.cost ?? 0) * 1e6) / 1e6;
  // The exact provider requests (content hashes) this approval covers; the run refuses any others.
  let specs = [];
  try { specs = approvedSoundSpecs(dir, kind); } catch {}
  return kind === 'voice' ? { kind, hash, model: s.narration.model, voice: s.narration.voice, style: s.narration.style, takes: (s.narration.takes ?? []).filter(t => t.cost > 0).map(t => t.id), cost, specs }
    : { kind, hash, model: s.music.model, prompt: s.music.prompt, bpm: s.music.bpm, cost, specs };
}
export const sameBasis = (a, b) => !!a && !!b && JSON.stringify(Object.keys(b).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));

/**
 * What a Google generation of `kind` would cost now. Approval is checked against this, and the
 * same amount is passed to the engine as its budget, so an estimate that grew is refused there too.
 */
export function estimate(dir, kind) {
  const s = soundState(dir);
  if (kind === 'voice') {
    if (s.narration.recorded) throw Object.assign(new Error('This film’s narration is the recording itself; it is edited by cutting words, not regenerated.'), { status: 409 });
    if (!s.narration.lines) throw Object.assign(new Error('There is no narration to record.'), { status: 409 });
    return { cost: s.narration.cost, takes: s.narration.takes.filter(t => t.cost > 0).map(t => t.id), detail: `${s.narration.takes.filter(t => t.cost > 0).length} take(s) changed or new` };
  }
  if (kind === 'music') {
    if (s.music.off) throw Object.assign(new Error('Music is off for this film.'), { status: 409 });
    return { cost: s.music.cost, detail: `${s.music.seconds ?? '?'} s bed with ${s.music.model}` };
  }
  throw Object.assign(new Error('Choose narration or music.'), { status: 400 });
}
