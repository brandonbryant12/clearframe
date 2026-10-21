import type { CritiqueContext } from './critique-contracts.mjs';

export function checkVoice(ctx: CritiqueContext) {
  const { sb, beats, add } = ctx;
  // Voice. Gemini TTS keeps one consistent voice when the film is one continuous take read
  // with one short style; per-line styles, long director's notes and stitched takes drift.
  const narrated = beats.filter((b) => b.vo);
  const takes = sb.voice.takes ?? 'film';
  if (narrated.length >= 4 && takes === 'beat')
    add(
      'idea',
      'voice',
      'Each line is recorded separately, so the voice can change between beats. Record the film as one continuous take (voice.takes: "film", the default).',
    );
  const styled = narrated.filter((b) => b.style);
  if (styled.length && takes !== 'beat' && !sb.voice.perBeatStyle)
    add(
      'idea',
      'voice',
      `${styled.length} beat(s) set their own style; the continuous take uses voice.style for every line. Shape delivery with the words: short sentences for punch, a question for lift, punctuation and <short pause> for timing.`,
    );
  const styleWords = String(sb.voice.style ?? '')
    .split(/\s+/)
    .filter(Boolean).length;
  if (styleWords > 10)
    add(
      'warn',
      'voice',
      `voice.style is ${styleWords} words. Long direction makes the voice drift; keep it to 2–6 words ("warm, curious, unhurried") and choose (or design) a voice for character.`,
    );
  const spoken = narrated.reduce(
    (n, b) => n + (b.vo ?? '').split(/\s+/).length,
    0,
  );
  const tags = narrated.reduce(
    (n, b) => n + ((b.vo ?? '').match(/<[^>]+>/g) ?? []).length,
    0,
  );
  if (tags > Math.max(2, spoken / 30))
    add(
      'idea',
      'voice',
      `${tags} inline tags in ${spoken} words. Tags are seasoning: a pause or breath at a turn, one laugh in a conversation. Let punctuation carry the rest.`,
    );
  const directions = narrated.filter((b) =>
    /\([^)]*(?:whisper|slow|pause|laugh|sigh|softly|excited)[^)]*\)|\[[^\]]+\]/i.test(
      b.vo ?? '',
    ),
  );
  if (directions.length)
    add(
      'warn',
      directions[0].id,
      'Stage directions in the narration text will be read aloud. Use an inline tag (<short pause>, <breath>) or the voice style instead.',
    );
}
