import { utcDay } from '../../../film/plot-data.mjs';

import type {
  Drawdown,
  OpenEpisode,
  DrawdownEpisode,
  DrawdownObservation,
} from './contracts.mjs';
import {
  own,
  values,
  frequencyOf,
  cadence,
  check,
  num,
  basis,
} from './inputs.mjs';

/** Drawdown and recovery use observed nonnegative levels, not unseen intra-period peaks. */
export function drawdownSeries(input: unknown): Drawdown {
  own(input, ['observations', 'frequency'], 'drawdown');
  const observations = values(input.observations),
    frequency = frequencyOf(input.frequency);
  cadence(observations, frequency);
  for (const p of observations)
    check(
      p.value === null || p.value >= 0,
      'drawdown needs nonnegative levels',
    );
  check(
    observations.some((p) => p.value !== null && p.value > 0),
    'drawdown needs an observed positive level',
  );
  // The running peak: its level and the date it was observed (always set together).
  let top: { value: number; date: string } | null = null,
    episode: OpenEpisode | null = null,
    maxDrawdown = 0;
  const episodes: DrawdownEpisode[] = [];
  const out: DrawdownObservation[] = [];
  for (const p of observations) {
    if (p.value === null) {
      out.push({
        ...p,
        observedPeak: top?.value ?? null,
        peakDate: top?.date ?? null,
        drawdown: null,
        missing: 'missing-level',
      });
      continue;
    }
    if (top === null) {
      if (p.value === 0) {
        out.push({
          ...p,
          observedPeak: null,
          peakDate: null,
          drawdown: null,
          missing: 'no-positive-peak',
        });
        continue;
      }
      top = { value: p.value, date: p.date };
    }
    if (p.value >= top.value) {
      completeEpisode(episode, p.date, episodes);
      episode = null;
      top = { value: p.value, date: p.date };
    }
    const drawdown = num(p.value / top.value - 1, 'drawdown');
    maxDrawdown = Math.min(maxDrawdown, drawdown);
    if (drawdown < 0)
      episode = trackTrough(
        episode,
        top,
        { date: p.date, value: p.value },
        drawdown,
      );
    out.push({
      ...p,
      observedPeak: top.value,
      peakDate: top.date,
      drawdown,
      missing: null,
    });
  }
  const final = observations[observations.length - 1];
  if (episode)
    episodes.push({
      ...episode,
      recoveryDate: null,
      recovered: false,
      calendarDays: utcDay(final.date) - utcDay(episode.peakDate),
    });
  return {
    ...basis(frequency),
    method: 'observed-running-peak',
    equalPeakRule: 'most-recent-observation',
    missingPolicy: 'preserve-known-observed-peak; unseen peaks remain unknown',
    missingDates: observations
      .filter((p) => p.value === null)
      .map((p) => p.date),
    maxDrawdown,
    currentDrawdown: out[out.length - 1].drawdown,
    episodes,
    observations: out,
  };
}

export interface ObservedLevel {
  date: string;
  value: number;
}

export function trackTrough(
  episode: OpenEpisode | null,
  top: ObservedLevel,
  p: ObservedLevel,
  drawdown: number,
): OpenEpisode {
  if (!episode)
    return {
      peakDate: top.date,
      peakValue: top.value,
      troughDate: p.date,
      troughValue: p.value,
      drawdown,
    };
  if (drawdown < episode.drawdown)
    Object.assign(episode, {
      troughDate: p.date,
      troughValue: p.value,
      drawdown,
    });
  return episode;
}

function completeEpisode(
  episode: OpenEpisode | null,
  date: string,
  episodes: DrawdownEpisode[],
): void {
  if (!episode) return;
  episodes.push({
    ...episode,
    recoveryDate: date,
    recovered: true,
    calendarDays: utcDay(date) - utcDay(episode.peakDate),
  });
}
