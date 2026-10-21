import type { ResolvedStoryboard } from '../../domain.mjs';

import type { GenerateOptions } from '../generate-model.mjs';
import { money, guardBudget, assertApproved } from '../generate-model.mjs';
import { soundSpecs, takeParts } from '../generate-specs.mjs';
import fs from 'node:fs';

import { cleanVoice } from '../audio.mjs';
import { loadStoryboard, paths } from '../project.mjs';
import { estimateDuration } from '../timing.mjs';
import { log } from '../util.mjs';

import * as tts from '../../../skills/gemini-tts/scripts/tts.mjs';

import { pendingVoiceLines, recordVoiceLine } from './voice-lines.mjs';

export async function voice(
  root: string,
  {
    draft = false,
    force = false,
    only,
    budget,
    'dry-run': dryRun = false,
  }: GenerateOptions = {},
) {
  const sb = loadStoryboard(root);
  if (dryRun && sb.voice.takes !== 'beat') {
    // The exact requests a real run would send, without a key or a call.
    return await voiceRequests(sb);
  }
  if (sb.voice.takes !== 'beat') {
    // Continuous takes (the whole film by default): one performance, split into beats afterwards.
    return await continuousVoice({ sb, draft, force, root, budget });
  }
  const P = paths(root);
  fs.mkdirSync(P.vo, { recursive: true });
  const provider = draft ? 'local' : sb.voice.provider;
  const todo = pendingVoiceLines({ sb, only, provider, P, force, draft });
  if (!todo.length) {
    log.ok('Voice is up to date.');
    return;
  }
  if (provider === 'gemini') {
    assertApproved('voice', soundSpecs(sb, 'voice'));
    const secs = todo.reduce(
      (a, x) => a + estimateDuration(x.b.vo, sb.voice.wpm),
      0,
    );
    const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
    log.step(
      `Gemini TTS: ${todo.length} line(s), ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)} (${sb.voice.model}, voice ${sb.voice.voice})`,
    );
    guardBudget(cost, budget ?? sb.budget);
  } else log.step(`Draft voice (local OS TTS, free): ${todo.length} line(s)`);

  for (const { b, spec, metaFile, wavFile } of todo) {
    await recordVoiceLine({ wavFile, provider, b, spec, sb, metaFile });
  }
}

export async function continuousVoice({
  sb,
  draft,
  force,
  root,
  budget,
}: ContinuousVoiceContext) {
  const { planTakes, recordTakes } = await import('../takes.mjs');
  const styled = sb.beats.filter((b) => b.vo && b.style);
  if (styled.length && !sb.voice.perBeatStyle)
    log.warn(
      `${styled.length} beat(s) set their own style; a continuous take uses voice.style for every line so the voice stays consistent. Shape delivery with the words, punctuation and a few inline tags instead (voice.perBeatStyle: true sends them anyway).`,
    );
  if (!draft && sb.voice.provider === 'gemini') {
    assertApproved('voice', soundSpecs(sb, 'voice'));
    // Only takes the recorder will actually make count: unchanged takes are kept, never re-bought.
    const { takeCurrent } = await import('../takes.mjs');
    const todo = planTakes(sb).filter(
      (t) => force || !takeCurrent(root, sb, t, sb.voice.provider),
    );
    const secs = todo
      .flatMap((t) => t.beats)
      .reduce((a, b) => a + estimateDuration(b.vo, sb.voice.wpm), 0);
    const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
    if (!todo.length)
      log.ok('Google narration is up to date: every take matches.');
    else
      log.step(
        `Gemini TTS: ${todo.length === 1 ? 'one continuous take' : `${todo.length} continuous takes`} (${todo.map((t) => t.id).join(', ')}), ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)}`,
      );
    guardBudget(cost, budget ?? sb.budget);
  } else
    log.step(
      `Draft voice in ${planTakes(sb).length === 1 ? 'one continuous take' : 'continuous takes'} (local OS TTS, free)`,
    );
  return recordTakes(root, sb, {
    draft,
    force,
    synthesize: async (spec, out) => {
      // A single voice reads the take as one text with one style: paragraphs between beats
      // give natural pauses, and nothing re-prompts the voice mid-performance.
      const r = await tts.synthesize({
        parts: takeParts(sb, spec),
        cast: spec.cast,
        voice: spec.voice,
        model: spec.model,
        language: spec.language ?? undefined,
      });
      if (!r.wav) throw new Error(`TTS returned ${r.mimeType}, expected WAV`);
      fs.writeFileSync(`${out}.raw`, r.wav);
      await cleanVoice(`${out}.raw`, out);
      fs.rmSync(`${out}.raw`, { force: true });
    },
  });
}

export async function voiceRequests(sb: ResolvedStoryboard) {
  const { planTakes, takeSpec } = await import('../takes.mjs');
  return planTakes(sb).map((take) => {
    const spec = takeSpec(sb, take, 'gemini');
    return {
      take: take.id,
      beats: take.beats.map((b) => b.id),
      request: tts.buildRequest({
        parts: takeParts(sb, spec),
        cast: spec.cast,
        voice: spec.voice,
        model: spec.model,
        language: spec.language ?? undefined,
      }),
    };
  });
}

export interface ContinuousVoiceContext {
  sb: ResolvedStoryboard;
  draft: boolean;
  force: boolean;
  root: string;
  budget: number | null | undefined;
}
