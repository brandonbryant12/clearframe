// Summarises engine-bench rows without mixing trials. Every row is kept in bench.json; this
// derives medians and ranges per measure, and the warm per-still cost only from a cold and a
// ten-still run with the same run index. A derived cost at or below zero is noise (the ten-still
// run beat the one-still run), so it is reported as inconclusive, never as a faster-than-free
// still. Failed runs stay counted. These are prepared-picture measurements: they exclude
// authoring, preparation, audio finishing and QA, so they are not time to an accepted film.

export const BENCH_SCOPE =
  'prepared picture only: excludes authoring, preparation, audio finishing and QA; not time to an accepted film';

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** Median and range of the successful runs; `null` when none succeeded. */
export function stat(values) {
  if (!values.length) return null;
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    n: values.length,
  };
}

/** (ten stills − one still) / 9 for each run index both measures completed. */
export function pairedWarmStill(cold, ten) {
  const byRun = new Map(cold.map((r) => [r.run, r.ms]));
  const pairs = ten
    .filter((r) => byRun.has(r.run))
    .map((r) => ({
      run: r.run,
      ms: Math.round((r.ms - byRun.get(r.run)) / 9),
    }));
  const derived = stat(pairs.map((p) => p.ms));
  if (!derived) return { status: 'unpaired', pairs, median: null };
  // One non-positive pair means the noise is as large as the quantity measured.
  const status = pairs.some((p) => p.ms <= 0) ? 'inconclusive' : 'measured';
  return {
    status,
    pairs,
    ...derived,
    median: status === 'measured' ? derived.median : null,
  };
}

export function summarize(rows) {
  const summary = [];
  const keys = new Map();
  for (const r of rows) keys.set(`${r.project}\u0000${r.engine}`, r);
  for (const { project, engine } of keys.values()) {
    const all = (m) =>
      rows.filter(
        (r) => r.project === project && r.engine === engine && r.measure === m,
      );
    const ok = (m) => all(m).filter((r) => !r.error);
    const ms = (m) => ok(m).map((r) => r.ms);
    const measures = ['cold', 'ten', 'range', 'full'];
    const counts = Object.fromEntries(measures.map((m) => [m, all(m).length]));
    const failures = Object.fromEntries(
      measures.map((m) => [m, all(m).length - ok(m).length]),
    );
    const shape = all('full')[0] ?? all('range')[0] ?? all('cold')[0];
    const full = stat(ms('full'));
    const sized = [...ok('full'), ...ok('range')];
    summary.push({
      project,
      engine,
      format: shape ? `${shape.width}x${shape.height}@${shape.fps}` : null,
      frames: all('full')[0]?.frames ?? null,
      scope: BENCH_SCOPE,
      runs: counts,
      failures,
      coldStillMs: stat(ms('cold')),
      warmStillMs: pairedWarmStill(ok('cold'), ok('ten')),
      rangeMs: stat(ms('range')),
      fullMs: full,
      fullFps:
        full && all('full')[0]?.frames
          ? +(all('full')[0].frames / (full.median / 1000)).toFixed(1)
          : null,
      // Peaks are maxima by nature: the largest any successful run reached.
      peakMiB: sized.length
        ? Math.round(Math.max(...sized.map((r) => r.peakBytes)) / 2 ** 20)
        : null,
      tempMiB: sized.length
        ? +(Math.max(...sized.map((r) => r.diskBytes)) / 2 ** 20).toFixed(1)
        : null,
    });
  }
  return summary;
}

/** One table cell: "median (min–max)", or why there is no number. */
export function cell(value) {
  if (value == null) return '—';
  if (typeof value !== 'object') return String(value);
  if (value.status === 'inconclusive')
    return `inconclusive (${value.min}–${value.max})`;
  if (value.status === 'unpaired') return 'unpaired';
  return value.n > 1
    ? `${value.median} (${value.min}–${value.max})`
    : String(value.median);
}
