import fs from 'node:fs';
import path from 'node:path';

import { writeJSON } from '../lib/util.mjs';

import type { CommandContext } from './options.mjs';

export async function referenceCommand({ positionals, o }: CommandContext) {
  if (!positionals[0]) throw new Error('reference needs a video file');
  const { analyseReference } = await import('../lib/reference.mjs');
  const out = path.resolve(
    o.out ??
      path.join(
        'build/reference',
        path.basename(positionals[0]).replace(/\.[^.]+$/, ''),
      ),
  );
  const r = await analyseReference(positionals[0], out);
  return console.log(
    `${r.shots} shots · ${r.cutsPerMinute} cuts/min · median shot ${r.medianShot.toFixed(1)}s · ${r.motion.feel} · closest palette ${r.suggestedTheme.base}\n${path.relative(process.cwd(), path.join(out, 'REFERENCE.md'))} (+ sheet.png, opening.png)`,
  );
}

export async function planCommand({ cmd, opts, dir }: CommandContext) {
  const g = await import('../lib/generate.mjs');
  const actions = {
    plan: g.plan,
    voice: g.voice,
    music: g.scoreMusic,
    images: g.images,
    clips: g.clips,
  };
  if (!(cmd in actions)) throw new Error(`Unknown generation command ${cmd}`);
  const action = Object.entries(actions).find(([name]) => name === cmd)?.[1];
  if (!action) throw new Error(`Unknown generation command ${cmd}`);
  const result = await action(dir, opts);
  if (result) console.log(JSON.stringify(result, null, 2));
  return;
}

export async function speechCommand({ o, dir }: CommandContext) {
  if (!o.audio || !o.transcript)
    throw new Error('speech needs --audio and --transcript (text file)');
  const { importSpeech } = await import('../lib/speech.mjs');
  return console.log(
    await importSpeech(dir, {
      beat: o.beat,
      audio: o.audio,
      transcript: fs.readFileSync(o.transcript, 'utf8'),
      words: o.words
        ? JSON.parse(fs.readFileSync(o.words ?? '', 'utf8'))
        : undefined,
    }),
  );
}

export async function alignCommand({ o, dir }: CommandContext) {
  const { whisperAlign } = await import('../lib/whisper.mjs');
  const report = await whisperAlign(dir, {
    beat: o.beat,
    model: o.model,
    force: o.force,
  });
  return console.log(
    report.map((r) => `${r.id.padEnd(16)} ${r.status}`).join('\n'),
  );
}

export async function align2Command({ o, opts, dir }: CommandContext) {
  if (Boolean(o.words) === Boolean(o.transcribe))
    throw new Error('Choose --words, --transcribe or --whisper');
  const s = await import('../lib/speech.mjs');
  const result = o.transcribe
    ? await s.transcribeSpeech(dir, opts)
    : s.alignSpeech(dir, {
        beat: o.beat,
        words: JSON.parse(fs.readFileSync(o.words ?? '', 'utf8')),
      });
  return console.log(
    `Aligned ${result.length} words to the current recording.`,
  );
}

export async function timingCommand({ cmd, o, dir }: CommandContext) {
  const t = await import('../lib/timing.mjs'),
    timing = t.computeTiming(dir);
  writeJSON(path.join(dir, 'build/timing.json'), timing);
  if (cmd === 'timing') return console.log(JSON.stringify(timing, null, 2));
  if (
    !o.draft &&
    timing.beats.some((b) => b.vo && b.vo.wordTiming !== 'measured')
  )
    throw new Error(
      'Caption export requires measured word timestamps; align each take, or use --draft for rough captions.',
    );
  const cues = t.captionCues(timing);
  fs.writeFileSync(path.join(dir, 'build/captions.srt'), t.toSRT(cues));
  fs.writeFileSync(path.join(dir, 'build/captions.vtt'), t.toVTT(cues));
  return console.log(
    'Wrote captions. Timing quality is recorded in build/timing.json.',
  );
}
