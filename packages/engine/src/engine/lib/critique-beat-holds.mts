import { isRecord } from './errors.mjs';

import { staged } from './critique-common.mjs';

import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatHolds(ctx: BeatCheckContext): void {
  const { sb, add, b, d } = ctx;
  const moving =
    (b.camera !== 'none' &&
      (typeof b.camera !== 'object' || b.camera.move !== 'none')) ||
    b.plate ||
    JSON.stringify(b.props ?? {}).match(/"loop"|"keys"|"along"|"steps"/);
  if (d > 8 && !moving && b.block !== 'kinetic')
    add(
      'idea',
      b.id,
      `Held ${d.toFixed(1)} s with nothing moving. Inspect the reading hold; shorten it or reveal the next meaningful change if it feels stalled. Do not add camera shake.`,
    );
  // Length reached by talking longer over the same picture (round 16: five beats of 10–14 s, a closing
  // "0" held for 12 s). Two or more sentences over one picture this long are two beats.
  const sentences = String(b.vo ?? '')
    .split(/(?<=[.!?])\s+/)
    .filter((x) => /\w/.test(x)).length;
  // A picture with a moment per sentence (sketch moments, cued chart values, cued elements) keeps up.
  const written = sb.beats.find((x) => x.id === b.id)?.props ?? {};
  const moments =
    Object.keys(written.sketchSay ?? {}).length +
    (Array.isArray(written.chart?.values) ? written.chart.values : []).filter(
      (v: unknown) => isRecord(v) && v.say,
    ).length +
    (JSON.stringify(written.elements ?? []).match(/"say":/g) ?? []).length;
  if (
    d > 9.5 &&
    sentences >= 2 &&
    moments < sentences &&
    b.pace !== 'hold' &&
    b.block !== 'kinetic' &&
    !b.props?.cast &&
    !staged(b)
  )
    add(
      'warn',
      b.id,
      `${d.toFixed(1)} s and ${sentences} sentences on one picture: a viewer has seen it all long before the voice is done. Split the line into beats, each with its own picture (a longer film needs more pictures, not more words over one).`,
    );
}
