import type { BeatState } from './job-beat-contracts.mjs';

export function canvasGround(state: BeatState): void {
  const { b, props, sb, transitions } = state;
  // A hard cut lands on the drawing's ground: its cards and panels at the start are there on
  // the first frame instead of rising in, which left a blank frame or two after every cut (a
  // reviewer called them render glitches). Details, words and later moments still enter.
  if (
    b.index > 0 &&
    transitions[b.index] === 'cut' &&
    !sb.beats[b.index - 1]?.props?.world
  )
    for (const el of props.elements ?? [])
      if (
        (el.at ?? 0) <= 0.05 &&
        ['rect', 'group', 'image'].includes(el.type) &&
        ['rise', 'fade', 'pop', 'scale', undefined].includes(el.enter)
      ) {
        el.enter = 'none';
        el.dur = 0;
      }
}
export function canvasDepth(state: BeatState): void {
  const { props, cue } = state;
  // Camera depth keys resolve their spoken cues; like camera drift, they never hold the beat.
  for (const k of [...(props.dolly ?? []), ...(props.focus?.keys ?? [])]) {
    if (k.say != null) {
      k.at = cue(k.say);
      delete k.say;
    }
    k.dur ??= 1.2;
  }
  props.dolly?.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  props.focus?.keys?.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}
