import type { CritiqueContext, CritiqueBeat } from './critique-contracts.mjs';
import { family, matched, FULL_FRAME } from './critique-common.mjs';

export function checkSameness(ctx: CritiqueContext) {
  const { sb, beats, add } = ctx;
  // Sameness. Drawings are told apart by what they draw (a sketch's name, a cast, a chart's kind):
  // three different workplace pictures in a row are a sequence, not a slide run, and the old rule
  // pushed agents to swap a picture for kinetic type to break it up.
  const pictureOf = (i: number) => {
    const p = sb.beats[i]?.props ?? {};
    if (p.sketch) return p.sketch;
    if (p.cast) return 'cast';
    return p.chart ? `chart-${p.chart.kind}` : null;
  };
  let run = 1;
  for (let i = 1; i < beats.length; i++) {
    // A world is one continuous picture on purpose; the camera move is the change.
    const world =
      beats[i].props?.world &&
      beats[i].props?.world === beats[i - 1].props?.world;
    // Drawings with their own camera (a dolly, a truck) are different shots, as in a montage.
    const shot = (b: CritiqueBeat) =>
      b.block === 'canvas' && (b.props?.dolly || b.props?.viewFrom);
    run =
      family(beats[i]) === family(beats[i - 1]) &&
      !beats[i].plate &&
      !beats[i].tone &&
      !world &&
      !shot(beats[i]) &&
      !matched(beats[i - 1], beats[i]) &&
      !(
        pictureOf(i) &&
        pictureOf(i - 1) &&
        pictureOf(i) !== pictureOf(i - 1)
      ) &&
      beats[i].vo
        ? run + 1
        : 1;
    if (run === 3)
      add(
        'warn',
        `${beats[i - 2].id}…${beats[i].id}`,
        `Three ${family(beats[i])} scenes in a row. Change the picture: a drawing, a plate, a colour block, poster type.`,
      );
  }
  const headered = beats.filter((b) => b.props?.title && !FULL_FRAME(b)).length;
  if (beats.length >= 5 && headered / beats.length > 0.6)
    add(
      'warn',
      'film',
      `${headered} of ${beats.length} scenes are a heading over a graphic. That is the slide-deck look: give some scenes the whole frame (align center, tone, plate, kinetic stack, canvas).`,
    );
}
