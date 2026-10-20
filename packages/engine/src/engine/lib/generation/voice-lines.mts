import type { ResolvedStoryboard } from '../../domain.mjs';
import type { ProjectPaths } from '../project.mjs';
import type { NarratedBeat } from '../generate-model.mjs';
import { nonempty, lineMeta, narrated } from '../generate-model.mjs';
import { voiceSpec } from '../generate-specs.mjs';
import fs from 'node:fs';

import path from 'node:path';
import { analyseVoice, cleanVoice, draftVoice } from '../audio.mjs';

import { tokenize } from '../timing.mjs';
import { hashOf, log, writeJSON } from '../util.mjs';

import * as tts from '../../../skills/gemini-tts/scripts/tts.mjs';

export async function recordVoiceLine({
  wavFile,
  provider,
  b,
  spec,
  sb,
  metaFile,
}: RecordVoiceLineContext) {
  const raw = `${wavFile}.raw`;
  if (provider === 'gemini') {
    const r = await tts.synthesize({
      text: b.vo,
      voice: spec.voice,
      style: spec.style || undefined,
      model: spec.model,
      language: spec.language || undefined,
    });
    if (!r.wav)
      throw new Error(`[${b.id}] TTS returned ${r.mimeType}, expected WAV`);
    fs.writeFileSync(raw, r.wav);
    await cleanVoice(raw, wavFile);
    fs.rmSync(raw, { force: true });
  } else {
    await draftVoice(b.vo, wavFile, {
      wpm: sb.voice.wpm,
      voice: sb.voice.draftVoice,
      pronounce: sb.voice.pronounce,
    });
  }
  const a = await analyseVoice(wavFile, b.vo);
  writeJSON(metaFile, {
    hash: hashOf(spec),
    textHash: hashOf(b.vo),
    provider,
    model: provider === 'gemini' ? spec.model : 'os-tts',
    // A draft line records the OS voice that spoke it, apart from the Google voice it is set to.
    voice: provider === 'gemini' ? spec.voice : null,
    ...(provider === 'gemini'
      ? {}
      : { osVoice: sb.voice.draftVoice ?? 'system default' }),
    style: provider === 'gemini' ? spec.style : '',
    text: b.vo,
    ...a,
    createdAt: new Date().toISOString(),
  });
  const wpm = Math.round((tokenize(b.vo).length / a.duration) * 60);
  log.ok(
    `${b.id}: ${a.duration.toFixed(2)}s · ${wpm} wpm · ${a.segments.length} phrase(s)`,
  );
}

export function pendingVoiceLines({
  sb,
  only,
  provider,
  P,
  force,
  draft,
}: PendingVoiceLinesContext) {
  const todo = [];
  for (const b of sb.beats.filter(narrated)) {
    if (only && !only.includes(b.id)) continue;
    const spec = voiceSpec(sb, b, provider);
    const metaFile = path.join(P.vo, `${b.id}.json`);
    const wavFile = path.join(P.vo, `${b.id}.wav`);
    const meta = lineMeta(metaFile);
    const cached = meta?.hash === hashOf(spec) && nonempty(wavFile);
    if (cached && !force) continue;
    if (
      meta?.provider === 'imported' &&
      meta.textHash === hashOf(b.vo) &&
      nonempty(wavFile) &&
      !force
    ) {
      log.dim(
        `  ${b.id}: keeping the imported recording (use --force to replace)`,
      );
      continue;
    }
    if (
      draft &&
      meta?.provider === 'gemini' &&
      meta.textHash === hashOf(b.vo) &&
      !force
    ) {
      log.dim(
        `  ${b.id}: keeping the real take (use --force to replace with a draft)`,
      );
      continue;
    }
    todo.push({ b, spec, metaFile, wavFile });
  }
  return todo;
}

export interface PendingVoiceLinesContext {
  sb: ResolvedStoryboard;
  only: readonly string[] | null | undefined;
  provider: string;
  P: ProjectPaths;
  force: boolean;
  draft: boolean;
}

export interface RecordVoiceLineContext {
  wavFile: string;
  provider: string;
  b: NarratedBeat;
  spec: ReturnType<typeof voiceSpec>;
  sb: ResolvedStoryboard;
  metaFile: string;
}
