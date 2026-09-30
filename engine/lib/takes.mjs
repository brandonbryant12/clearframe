// Continuous narration: record a chapter in one take so the delivery flows from beat to beat,
// then split the take back into beats at frame-aligned pauses. Beats replay the take gaplessly;
// their word timings come from local Whisper when available (measured), else silence (estimated).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { paths } from './project.mjs';
import { tokenize, estimateDuration, alignWords } from './timing.mjs';
import { alignScript } from './word-align.mjs';
import { audioHash } from './word-timing.mjs';
import { cleanVoice, speechSegments } from './audio.mjs';
import { readPCM } from './levels.mjs';
import { ffmpeg, hashOf, log, pcmToWav, readJSON, round, writeJSON } from './util.mjs';
import { cutPoints, timedWords } from './ingest.mjs';
import { whisperAvailable } from './whisper.mjs';

/**
 * Narrated beats grouped into takes. `film` (the default) records the whole narration in one
 * continuous take, which keeps one voice, one energy and one room tone from the first line
 * to the last; it splits at a chapter boundary only past ~8 minutes, well inside Gemini TTS
 * limits (8k input / 16k output tokens ≈ 10 min). `chapter` records one take per chapter
 * (≤ 14 beats, ≤ ~100 s).
 */
export function planTakes(sb) {
  const film = (sb.voice.takes ?? 'film') === 'film';
  const takes = [];
  let cur = null;
  for (const b of sb.beats) {
    const chapter = film ? '' : (b.chapter ?? '');
    const seconds = cur ? cur.seconds + estimateDuration(b.vo ?? '', sb.voice.wpm) : 0;
    const full =
      cur && (film ? seconds > 480 && b.chapter !== cur.lastChapter : cur.beats.length >= 14 || seconds > 100);
    if (!b.vo || !cur || cur.chapter !== chapter || full) {
      if (cur) takes.push(cur);
      cur = b.vo ? { chapter, beats: [], seconds: 0 } : null;
    }
    if (b.vo) {
      cur.beats.push(b);
      cur.seconds += estimateDuration(b.vo, sb.voice.wpm);
      cur.lastChapter = b.chapter;
    }
  }
  if (cur) takes.push(cur);
  return takes.map((t, i) => ({ id: `take-${String(i + 1).padStart(2, '0')}`, beats: t.beats }));
}

/** What a take asks the provider for; its hash caches the recording. */
export function takeSpec(sb, take, provider) {
  const cast = sb.voice.cast
    ? Object.entries(sb.voice.cast).map(([speaker, c]) => ({ speaker, voice: c.voice ?? sb.voice.voice }))
    : null;
  return {
    provider,
    model: sb.voice.model,
    voice: sb.voice.voice,
    cast,
    language: sb.voice.language ?? null,
    // One performance: every part of a take shares the film's (or the speaker's) style.
    // Per-beat styles re-prompt the voice mid-take and make it drift; they are sent only
    // when voice.perBeatStyle is set.
    style: sb.voice.style ?? '',
    parts: take.beats.map(b => ({
      text: b.vo,
      style: (sb.voice.perBeatStyle ? b.style : null) ?? sb.voice.cast?.[b.speaker]?.style ?? sb.voice.style ?? '',
      ...(cast ? { speaker: b.speaker } : {}),
    })),
  };
}

/** Draft takes with the OS voice: one continuous call per take (per part when a cast needs several voices). */
async function draftTake(sb, spec, out) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-take-'));
  try {
    const say = (text, voice, file) => {
      const r = spawnSync('say', [
        ...(voice ? ['-v', voice] : []),
        '-r',
        String(Math.round(sb.voice.wpm * 0.9)),
        '-o',
        file,
        text,
      ]);
      if (r.status !== 0) throw new Error(`say failed: ${r.stderr}`);
    };
    if (process.platform !== 'darwin')
      throw new Error('Draft takes need macOS say; record per beat instead (voice.takes: "beat").');
    const clean = t => t.replace(/<([^>]+)>/g, ' [[slnc 350]] ').replace(/\|[^|]*\|/g, ' ');
    if (!spec.cast) {
      const f = path.join(tmp, 'take.aiff');
      say(spec.parts.map(p => clean(p.text)).join(' [[slnc 420]] '), sb.voice.draftVoice, f);
      await cleanVoice(f, out);
      return null;
    }
    const voices = {},
      pool = ['Samantha', 'Daniel', 'Karen', 'Moira', 'Rishi', 'Tessa'];
    spec.cast.forEach((c, i) => {
      voices[c.speaker] = sb.voice.cast[c.speaker]?.draftVoice ?? pool[i % pool.length];
    });
    const files = spec.parts.map((p, i) => {
      const f = path.join(tmp, `p${i}.aiff`);
      say(clean(p.text), voices[p.speaker], f);
      return f;
    });
    const inputs = files.flatMap(f => ['-i', f]);
    const filter =
      files.map((_, i) => `[${i}:a]aresample=24000,apad=pad_dur=0.35[a${i}]`).join(';') +
      ';' +
      files.map((_, i) => `[a${i}]`).join('') +
      `concat=n=${files.length}:v=0:a=1[o]`;
    await ffmpeg([
      '-y',
      ...inputs,
      '-filter_complex',
      filter,
      '-map',
      '[o]',
      '-ac',
      '1',
      '-ar',
      '24000',
      '-c:a',
      'pcm_s16le',
      out,
    ]);
    // Parts were joined here, so the boundaries are known exactly.
    const bounds = [];
    let t = 0;
    for (const f of files) {
      const d = Number(
        spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], {
          encoding: 'utf8',
        }).stdout,
      );
      bounds.push([t, t + d]);
      t += d + 0.35;
    }
    return bounds;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Word timings for several takes in one Whisper pass (the model loads once): takes are joined
 * with a second of silence, transcribed, split by offset and mapped onto each take's script.
 */
async function heardWordsMany(files, tokenLists, language) {
  if (!files.length || !whisperAvailable()) return files.map(() => null);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-takew-'));
  try {
    const gap = 1.0,
      offsets = [];
    let cursor = 0;
    for (const f of files) {
      offsets.push(cursor);
      const { rate, pcm } = readPCM(f);
      cursor += pcm.length / 2 / rate + gap;
    }
    const joined = path.join(tmp, 'takes.wav');
    const filter =
      files.map((_, i) => `[${i}:a]aresample=16000,apad=pad_dur=${gap}[a${i}]`).join(';') +
      ';' +
      files.map((_, i) => `[a${i}]`).join('') +
      `concat=n=${files.length}:v=0:a=1[o]`;
    await ffmpeg([
      '-y',
      ...files.flatMap(f => ['-i', f]),
      '-filter_complex',
      filter,
      '-map',
      '[o]',
      '-ac',
      '1',
      '-ar',
      '16000',
      joined,
    ]);
    const r = spawnSync(
      'whisper',
      [
        joined,
        '--model',
        'base',
        '--word_timestamps',
        'True',
        '--output_format',
        'json',
        '--output_dir',
        tmp,
        '--fp16',
        'False',
        '--language',
        language ?? 'en',
      ],
      { encoding: 'utf8' },
    );
    if (r.status !== 0) return files.map(() => null);
    const heard = timedWords(JSON.parse(fs.readFileSync(path.join(tmp, 'takes.json'), 'utf8')));
    return files.map((_, i) => {
      const start = offsets[i],
        end = i + 1 < offsets.length ? offsets[i + 1] : Infinity;
      const mine = heard
        .filter(w => w.t0 >= start - gap / 2 && w.t0 < end - gap / 2)
        .map(w => ({ ...w, t0: Math.max(0, w.t0 - start), t1: Math.max(0.02, w.t1 - start) }));
      return mine.length ? alignScript(tokenLists[i], mine) : null;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Record (or reuse) every take and split it into per-beat takes with word timings. */
export async function recordTakes(root, sb, { draft, force, synthesize }) {
  const P = paths(root),
    dir = path.join(P.vo, 'takes'),
    fps = sb.format.fps;
  fs.mkdirSync(dir, { recursive: true });
  const provider = draft ? 'local' : sb.voice.provider;
  // Pass 1: record every take that changed.
  const pending = [];
  for (const take of planTakes(sb)) {
    const spec = takeSpec(sb, take, provider),
      hash = hashOf(spec);
    const wav = path.join(dir, `${take.id}.wav`),
      meta = readJSON(path.join(dir, `${take.id}.json`), null);
    const beatsCurrent = take.beats.every(
      b =>
        readJSON(path.join(P.vo, `${b.id}.json`), null)?.take?.hash === hash &&
        fs.existsSync(path.join(P.vo, `${b.id}.wav`)),
    );
    if (!force && meta?.hash === hash && fs.existsSync(wav) && beatsCurrent) continue;
    if (
      !force &&
      draft &&
      take.beats.some(b => ['gemini', 'imported'].includes(readJSON(path.join(P.vo, `${b.id}.json`), null)?.provider))
    ) {
      log.dim(`  ${take.id}: keeping real takes (use --force to replace with a draft)`);
      continue;
    }
    let bounds = null;
    if (!force && meta?.hash === hash && fs.existsSync(wav)) bounds = meta.bounds ?? null;
    else if (provider === 'local') bounds = await draftTake(sb, spec, wav);
    else {
      await synthesize(spec, wav);
    }
    // Record the take as soon as it exists, so a later failure never pays for it twice.
    writeJSON(path.join(dir, `${take.id}.json`), {
      hash,
      provider,
      beats: take.beats.map(b => b.id),
      bounds,
      createdAt: new Date().toISOString(),
    });
    pending.push({ take, spec, hash, wav, bounds, tokensPerBeat: take.beats.map(b => tokenize(b.vo).map(t => t.w)) });
  }
  // Pass 2: one recognizer pass for all of them.
  const alignedAll = await heardWordsMany(
    pending.map(x => x.wav),
    pending.map(x => x.tokensPerBeat.flat()),
    sb.voice.language,
  );
  // Pass 3: split each take into beats.
  for (const [n, { take, spec, hash, wav, bounds, tokensPerBeat }] of pending.entries()) {
    const { rate, pcm } = readPCM(wav),
      duration = pcm.length / 2 / rate;
    let perBeat = null,
      measured = false;
    if (bounds) perBeat = bounds.map(([a, e]) => ({ start: a, end: e, words: null }));
    const aligned = alignedAll[n];
    if (aligned) {
      // Split the take's words back into beats.
      let k = 0;
      const groups = tokensPerBeat.map(t => {
        const g = aligned.words.slice(k, k + t.length);
        k += t.length;
        return g;
      });
      perBeat = groups.map((g, i) => ({
        start: perBeat?.[i]?.start ?? g[0].t0,
        end: perBeat?.[i]?.end ?? g.at(-1).t1,
        words: g,
      }));
      measured = true;
    } else if (!perBeat) {
      // No recognizer: the take's pauses, matched to the parts by expected length.
      const { segments } = await speechSegments(wav);
      const weights = take.beats.map(b => estimateDuration(b.vo, sb.voice.wpm)),
        total = weights.reduce((a, b) => a + b, 0);
      const gaps = segments
        .slice(1)
        .map((s, i) => ({ at: (segments[i].end + s.start) / 2, len: s.start - segments[i].end }));
      let acc = 0;
      const picks = [];
      for (let i = 0; i < take.beats.length - 1; i++) {
        acc += weights[i];
        const expected = (duration * acc) / total;
        const best = gaps
          .filter(g => !picks.includes(g) && (!picks.length || g.at > picks.at(-1).at))
          .sort((a, b) => Math.abs(a.at - expected) - Math.abs(b.at - expected) - 0.5 * (a.len - b.len))[0];
        if (!best)
          throw new Error(
            `${take.id}: could not find a pause between beats; record per beat (voice.takes: "beat") or install Whisper.`,
          );
        picks.push(best);
      }
      const edges = [0, ...picks.map(g => g.at), duration];
      perBeat = take.beats.map((_, i) => ({ start: edges[i], end: edges[i + 1], words: null }));
    }
    // Frame-aligned cuts inside the pauses between beats, so the slices tile the take.
    const cuts = cutPoints(
      perBeat.map(p => [
        { t0: p.start, t1: p.start },
        { t0: p.end, t1: p.end },
      ]),
      duration,
      fps,
    );
    take.beats.forEach((b, i) => {
      const start = cuts[i],
        end = cuts[i + 1];
      const a = Math.round(start * rate),
        e = Math.round(end * rate);
      const slice = Buffer.alloc(Math.max(0, e - a) * 2);
      pcm.copy(slice, 0, a * 2, Math.min(pcm.length, e * 2));
      const file = path.join(P.vo, `${b.id}.wav`);
      fs.writeFileSync(file, pcmToWav(slice, { sampleRate: rate }));
      const sliceDur = slice.length / 2 / rate;
      const words = perBeat[i].words
        ? perBeat[i].words
            .map(w => ({
              w: w.w,
              t0: round(Math.max(0, w.t0 - start), 4),
              t1: round(Math.min(sliceDur, w.t1 - start), 4),
              ...(w.estimated ? { estimated: true } : {}),
            }))
            .map((w, k, arr) => ({ ...w, t0: k ? Math.max(w.t0, arr[k - 1].t1) : w.t0 }))
            .map(w => ({ ...w, t1: Math.max(w.t1, w.t0 + 0.02) }))
        : null;
      const interpolated = words ? words.filter(w => w.estimated).length : null;
      const clean = words?.map(({ estimated, ...w }) => w);
      const segs = [{ start: perBeat[i].start - start, end: perBeat[i].end - start }];
      writeJSON(path.join(P.vo, `${b.id}.json`), {
        hash,
        textHash: hashOf(b.vo),
        provider,
        model: provider === 'local' ? 'os-tts' : spec.model,
        voice: spec.voice,
        style: spec.parts[i].style,
        text: b.vo,
        duration: sliceDur,
        take: { id: take.id, index: i, count: take.beats.length, hash },
        words: clean ?? alignWords(b.vo, segs, sliceDur),
        ...(measured && clean
          ? {
              alignment: {
                kind: interpolated ? 'estimated' : 'measured',
                provider: 'whisper-base',
                audioHash: audioHash(file),
                ...(interpolated ? { interpolatedWords: interpolated } : {}),
              },
            }
          : {}),
        createdAt: new Date().toISOString(),
      });
    });
    writeJSON(path.join(dir, `${take.id}.json`), {
      hash,
      provider,
      beats: take.beats.map(b => b.id),
      duration,
      bounds,
      createdAt: new Date().toISOString(),
    });
    log.ok(
      `${take.id}: ${take.beats.length} beats · ${duration.toFixed(1)}s continuous take${measured ? ' · words measured with Whisper' : ''}`,
    );
  }
}
