import type { CritiqueContext } from './critique-contracts.mjs';
import { staged, matched } from './critique-common.mjs';

export function checkImagery(ctx: CritiqueContext) {
  const { timing, beats, add } = ctx;
  const drawn = beats.filter(
      (b) => b.block === 'canvas' || b.art || staged(b),
    ).length,
    imaged = beats.filter(
      (b) => b.plate || ['image', 'video', 'annotate'].includes(b.block ?? ''),
    ).length;
  if (timing.duration > 40 && !drawn)
    add(
      'idea',
      'film',
      'Nothing is drawn. Where the narration explains how or why, draw it (canvas; start from clearframe sketch).',
    );
  if (timing.duration > 40 && !imaged && !drawn)
    add(
      'idea',
      'film',
      'No imagery at all. A plate (photo or generated still with a duotone treatment) grounds a film in the world.',
    );
  // Consecutive drawings that cut from one to the next could be one world the camera travels.
  for (let i = 2; i < beats.length; i++) {
    const run = beats.slice(i - 2, i + 1);
    if (
      run.every(
        (b) =>
          b.block === 'canvas' &&
          !b.props?.world &&
          !b.props?.dolly &&
          !b.props?.viewFrom &&
          b.vo,
      ) &&
      !run.some((b, j) => j && matched(run[j - 1], b)) &&
      beats[i + 1]?.block !== 'canvas'
    )
      add(
        'idea',
        run[0].id,
        `${run.map((b) => b.id).join(', ')} are separate drawings in a row. If they are stops on one journey, process or map, make them one world (props.world + camera view) so the camera travels instead of cutting.`,
      );
  }
  return { drawn, imaged };
}
