import type { Element } from '../domain.mjs';
import type { ReviewedBeat } from './qa-contracts.mjs';

import { pictureFor, chartFor, castFor } from './pictures.mjs';

import { spoken } from './word-align.mjs';

export const clip = (t: string, n: number): string =>
  t.length > n ? `${t.slice(0, n - 1)}…` : t;
export const TYPE_BLOCKS = [
  'kinetic',
  'statement',
  'title',
  'quote',
  'endcard',
  'chapter',
  'list',
  'checklist',
  'callout',
];
export const NUMBER_CARDS = [
  'stat',
  'kpis',
  'delta',
  'magnitude',
  'donut',
  'waffle',
  'compare',
];
/** Canvas props that set the frame or credit it, not a picture. */
export const FRAMING = new Set([
  'elements',
  'source',
  'view',
  'viewFrom',
  'camera',
  'background',
  'ground',
  'title',
  'subtitle',
  'eyebrow',
  'kicker',
  'align',
  'type',
  'look',
]);
/**
 * A canvas beat that is only lines of type (text, with boxes or rules behind it): a statement written as
 * elements. Round-13 films moved their actions and closes there, past the checks for type on its own.
 */
export function typedCanvas(beat: ReviewedBeat | undefined): boolean {
  const p = beat?.props ?? {};
  if (
    beat?.block !== 'canvas' ||
    beat.plate ||
    beat.stage ||
    beat.art?.under?.length ||
    !Array.isArray(p.elements)
  )
    return false;
  if (Object.keys(p).some((k) => !FRAMING.has(k))) return false;
  let text = 0,
    other = 0;
  const walk = (list: readonly Element[] | undefined): void =>
    (list ?? []).forEach((el) => {
      if (el.type === 'text') text++;
      else if (el.type === 'group') walk(el.children);
      else if (
        !['rect', 'line'].includes(el.type) ||
        el.keys ||
        el.along ||
        el.loop
      )
        other++;
    });
  walk(p.elements);
  return text > 0 && other === 0;
}
/**
 * The picture for a line, ready to act on: a sketch that fits it; else a cast of the film's objects
 * (with the line's figure for the beat after); else the chart for its figures; else the recipe for its
 * kind of idea. Null when nothing fits.
 */
export function pictureLine(vo: string | undefined): string | null {
  const f = pictureFor(vo ?? '');
  if (f?.sketch)
    return `the \`${f.sketch}\` sketch (${f.why.toLowerCase().replace(/^this line is /, '')}; \`sketch ${f.sketch}\` prints the beat to paste)`;
  const cast = castFor(vo ?? '', spoken),
    chart = chartFor(vo ?? '', spoken);
  const plurality = (chart?.values.length ?? 0) > 1 ? 's' : '';
  const chartSuffix = chart
    ? `, then the figure${plurality} it says (${chart.values.map((v) => v.say).join(', ')}) as a canvas ` +
      '`chart`' +
      ` in the beat after`
    : '';
  if (cast)
    return `paste {"block": "canvas", "props": {"source": "…", ${JSON.stringify(cast).slice(1, -1)}}} (labels and colours are yours)${chartSuffix}`;
  if (chart)
    return `paste {"block": "canvas", "props": {"source": "…", "chart": ${JSON.stringify(chart)}}} and name each value (its label)`;
  return f?.use ?? null;
}
/** The change that fits a still beat, from what it is made of. */
export function stillFix(beat: ReviewedBeat): string {
  const p = beat.props ?? {};
  if (typedCanvas(beat))
    return `This is type on its own, drawn on a canvas: give the idea a picture that changes on those words (${pictureLine(beat.vo) ?? "a sketch from `sketch`, a cast of the film's objects, or a chart with a `say` on each value"}), or fold the line into the next picture's narration.`;
  if (p.sketch)
    return `Land a later moment of the ${p.sketch} sketch on one of those words (sketchSay; \`sketch ${p.sketch}\` lists its moments in order), or shorten the beat to its last moment.`;
  if (p.chart)
    return `Give each chart value a \`say\` word from that line so each figure lands as it is spoken${p.chart.kind === 'number' ? ' (a number with several cued values steps through them)' : ''}, or add a \`note\` on the word that makes the point.`;
  if (p.cast)
    return 'Give the cast a formation or a move (a swap, a merge, a hero) on one of those words.';
  if (p.world || beat.stage)
    return 'Move the camera or an actor on one of those words.';
  if (beat.block === 'canvas')
    return 'Cue an element or a key (`say`) on one of those words, so the drawing changes while it is explained.';
  if (NUMBER_CARDS.includes(beat.block ?? ''))
    return 'This is a number card: give each figure its own moment as it is said (a canvas `chart` with a `say` on each value, or the sketch for this kind of fact: `match` for money added, `split` for where it goes).';
  if (TYPE_BLOCKS.includes(beat.block ?? ''))
    return 'This is type on its own: give the idea a picture that changes on those words (`critique` names a sketch for it), or cut the beat to the line.';
  return 'Change something on one of those words, or shorten the beat.';
}

/** How to fill a beat's empty opening, from what it is made of. */
export function emptyFix(beat: ReviewedBeat | undefined): string {
  const p = beat?.props ?? {};
  const cue = (JSON.stringify(p.chart?.values ?? []).match(/"say":"([^"]+)"/) ??
    [])[1];
  if (p.chart && cue)
    return `its chart waits for "${cue}" with only its label showing: land the first value on one of the first words the voice says (its \`say\`), or start the line on the figure`;
  if (p.sketch)
    return `land the ${p.sketch} sketch's first moment on one of the first words (sketchSay), or open the line on that moment`;
  return "put the scene's picture on its first frame (its card, its chart, its object) and animate only the change on the words";
}
/** How to make a beat's picture fill its frame, from what it is made of. */
export function sizeFix(beat: ReviewedBeat): string {
  const p = beat.props ?? {};
  if (p.cast)
    return 'Give the objects a larger `size` (up to 360), a `spread` for the formation, or a camera `zoom` on the cast.';
  if (p.chart || p.box)
    return 'Give the chart a larger `box` ([x, y, w, h] in frame pixels).';
  if (beat.block === 'canvas')
    return 'Fit the drawing to the space with `view: "auto"` (its bounds, enlarged up to 2×), or draw it larger.';
  return 'Use the space: a larger size, or a layout that spans the frame.';
}
