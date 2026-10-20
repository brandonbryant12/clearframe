import { glyphCheck } from './glyphs.mjs';
import { typeById } from './library.mjs';
import { voiceOf, voiceFace, DEFAULT_VOICE } from './type.mjs';

import { checkNarration } from './job-narration.mjs';

import type { BeatState } from './job-beat-contracts.mjs';

export function validateBeatVoice({
  b,
  source,
  props,
  spec,
  film,
  frame,
  report,
}: BeatState): void {
  glyphCheck(props, `${b.id}.props`, (m) => {
    throw new Error(m);
  });
  // Display text set in the voice's face is checked against that face's own coverage.
  const voice =
    source.type != null
      ? (voiceOf(source.type, typeById(source.type)) ?? DEFAULT_VOICE)
      : film.type;
  const face = voiceFace(voice);
  if (
    face &&
    (spec.hero ||
      ['chapter', 'highlight'].includes(b.block ?? '') ||
      props.title != null)
  )
    for (const k of ['text', 'title'] as const)
      if (typeof props[k] === 'string')
        glyphCheck(
          props[k],
          `${b.id}.props.${k}`,
          (m) => {
            throw new Error(m);
          },
          face,
        );
  checkNarration(
    b,
    frame,
    film.captions,
    report,
    b.block === 'kinetic' ? face : null,
  );
}
