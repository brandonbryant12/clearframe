import type { VerdictState } from './qa-verdict-state.mjs';
import { fixOf } from './qa-verdict-state.mjs';
export function nextEdit(state: VerdictState): string {
  const { share, worst, typeShare, blank, short, s, sb, dropped, pictures } =
    state;
  const first = prerequisite(state);
  if (first) return first;
  const picture = pictures.find(([, l]) => l);
  if (share >= 40 && worst.length) {
    const [id] = worst[0],
      f = fixOf(state, id);
    return `${id}: ${f?.fix ?? 'change something on its later words, or shorten it.'}`;
  }
  if (typeShare >= 60 && picture) return `${picture[0].id}: ${picture[1]}.`;
  if (blank.length) return blank[0].trim();
  if (short)
    return `the film is ${Math.round(s.seconds)} s of ${sb.length} s: add the brief's next fact as a beat with its own picture${dropped.length ? ` ("${dropped[0]}")` : ''}.`;
  return worst.length
    ? `${worst[0][0]}: ${fixOf(state, worst[0][0])?.fix ?? 'change something on its later words.'}`
    : 'fix the first item above.';
}

function prerequisite(state: VerdictState): string | null {
  const {
    unbound,
    evidence,
    placeholders,
    fileSources,
    mute,
    broken,
    overlaps,
  } = state;
  if (unbound)
    return evidence.scope === 'unbound'
      ? "measure the film's own render: run draft (or render), then qa on that video with its receipt beside it."
      : `${evidence.problems[0] ?? 'the receipt does not describe this video'}: render again, then run qa on the new video.`;
  if (placeholders.length)
    return `fill ${placeholders[0][1].join(', ')} in ${placeholders[0][0]}'s sketchText.`;
  if (fileSources.length)
    return `give ${fileSources[0]} a source line people know (the document's name, not a file).`;
  if (mute) return 'record the narration (`voice DIR --draft`).';
  if (broken.length)
    return `${broken[0].beat ?? 'the film'} at ${broken[0].t ?? '?'} s: ${broken[0].message}.`;
  if (overlaps.length) return `${overlaps[0][1]}: ${overlaps[0][2]}.`;
  return null;
}
