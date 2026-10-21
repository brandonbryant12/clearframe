import { isRecord } from './guards.mjs';
import { decodeRankInput } from './multiple-input.mjs';
// Ranked shared-axis panels. Ranking changes order, never observations or domains.
import { plotSpec, type PlotSeries, type PlotSpec } from './plot-data.mjs';
export const MULTIPLE_DATA_VERSION = 1;
function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`small multiples: ${m}`);
}
/** Check an object and its keys; its fields are checked by the caller. */
function own(v: unknown, keys: readonly string[]): void {
  check(isRecord(v), 'an input object is required');
  for (const k of Object.keys(v)) check(keys.includes(k), `unknown input.${k}`);
}
function byId(a: { id: string }, b: { id: string }): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
export interface RankInput {
  plot: unknown;
  rankAt: string;
  direction: string;
}
/** A series with its value on the ranking date and its competition rank (null when missing). */
export type RankedPanel = PlotSeries & {
  value: number | null;
  rank: number | null;
  tied: boolean;
};
export interface RankedSeries {
  version: number;
  plot: PlotSpec;
  rankAt: string;
  direction: string;
  tiePolicy: string;
  missingPolicy: string;
  panels: RankedPanel[];
}
export function rankSeries(raw: unknown): RankedSeries {
  const input = decodeRankInput(raw);
  // Its fields are checked below (the plot by plotSpec).
  own(input, ['plot', 'rankAt', 'direction']);
  const plot = plotSpec(input.plot);
  check(
    plot.x.type === 'date' && plot.y.type === 'linear',
    'shared dated x and linear y axes required',
  );
  check(plot.series.length >= 2, 'at least two series are required');
  check(
    ['ascending', 'descending'].includes(input.direction),
    'direction must be ascending or descending',
  );
  const dates = plot.series[0].values.map((p) => p.x);
  check(dates.length >= 2, 'at least two common dates required');
  for (const s of plot.series)
    check(
      s.values.length === dates.length &&
        s.values.every((p, i) => p.x === dates[i]),
      'all series need the same explicit date grid; retain null observations',
    );
  const index = dates.indexOf(input.rankAt);
  check(index >= 0, 'rankAt must name an explicit common date');
  const direction = input.direction === 'ascending' ? 1 : -1,
    panels = plot.series
      .map((s): RankedPanel => ({
        ...s,
        value: s.values[index].y,
        rank: null,
        tied: false,
      }))
      .sort((a, b) => comparePanel(a, b, direction));
  let last: number | undefined,
    rank = 0;
  for (const [i, p] of panels.entries()) {
    if (p.value === null) {
      p.rank = null;
      p.tied = false;
      continue;
    }
    if (i === 0 || p.value !== last) rank = i + 1;
    p.rank = rank;
    last = p.value;
    const value = p.value;
    p.tied = panels.some((other) => other.id !== p.id && other.value === value);
  }
  return {
    version: MULTIPLE_DATA_VERSION,
    plot,
    rankAt: input.rankAt,
    direction: input.direction,
    tiePolicy: 'competition-rank; stable-id-order',
    missingPolicy: 'unranked-last; no-carry-forward',
    panels,
  };
}

function comparePanel(
  a: RankedPanel,
  b: RankedPanel,
  direction: number,
): number {
  if (a.value === null) return b.value === null ? byId(a, b) : 1;
  if (b.value === null) return -1;
  return direction * (a.value - b.value) || byId(a, b);
}
