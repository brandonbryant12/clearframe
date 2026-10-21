export { TIME_SERIES_VERSION } from './time-series/contracts.mjs';
export type {
  Frequency,
  SeriesBasis,
  ValueObservation,
  PriceObservation,
  DeflatedObservation,
  Deflation,
  GrowthGap,
  GrowthObservation,
  Growth,
  RollingObservation,
  Rolling,
  DrawdownObservation,
  DrawdownEpisode,
  Drawdown,
} from './time-series/contracts.mjs';
export { deflateSeries } from './time-series/deflation.mjs';
export { growthSeries } from './time-series/growth.mjs';
export { rollingStatistics } from './time-series/rolling.mjs';
export { drawdownSeries } from './time-series/drawdown.mjs';
