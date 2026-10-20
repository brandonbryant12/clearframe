import type {
  AllocationRoute,
  Point,
  Card,
  TokenTrack,
} from '../scene-types.mjs';
import type {
  allocationPlan,
  allocationClock,
} from '../../allocation-data.mjs';
import { allocationAmount } from '../../allocation-data.mjs';

import { required } from '../validation.mjs';

import { check } from './check.mjs';
import { layoutAllocationCards } from './layout-allocation-cards.mjs';
import { layoutAllocationRoutes } from './layout-allocation-routes.mjs';

export function allocationLayout(
  model: ReturnType<typeof allocationPlan>,
  clock: ReturnType<typeof allocationClock>,
  w: number,
  h: number,
) {
  check(
    Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 960 &&
      h >= 960 &&
      w <= 4096 &&
      h <= 4096,
    'frame dimensions must be 960–4096',
  );
  check(
    model.buckets.length <= 3 && model.total <= 36 && model.events.length <= 8,
    'native trays support 2–3 buckets, up to 36 tokens and 8 individual moves',
  );
  const tall = h > w,
    n = model.buckets.length,
    font = w * (tall ? 0.032 : 0.021),
    small = w * (tall ? 0.03 : 0.0185),
    size = w * (tall ? 0.042 : 0.024),
    gap = size * 0.32,
    columns = 6,
    cards: Card[] = [];
  layoutAllocationCards({
    n,
    tall,
    w,
    h,
    columns,
    size,
    gap,
    font,
    model,
    small,
    cards,
  });
  const cardById = new Map(cards.map((c) => [c.id, c])),
    slot = (bucket: string, index: number): Point => {
      const c = required(
        cardById.get(bucket),
        'allocation scene: unknown bucket',
      );
      return [
        c.gridX + (index % columns) * (size + gap),
        c.gridY + Math.floor(index / columns) * (size + gap),
      ];
    };
  const tracks: TokenTrack[] = model.tokens.map((t) => ({
      id: t.id,
      initial: slot(t.initialBucket, t.initialSlot),
      keys: [],
    })),
    trackById = new Map(tracks.map((t) => [t.id, t])),
    positions = new Map<string, Point>(
      tracks.map((t) => [t.id, [...t.initial]]),
    ),
    routes: AllocationRoute[] = [];
  layoutAllocationRoutes({
    clock,
    slot,
    cardById,
    tall,
    w,
    size,
    positions,
    h,
    trackById,
    routes,
  });
  return {
    width: w,
    height: h,
    tall,
    font,
    small,
    size,
    cards,
    tracks,
    routes,
    finalPositions: Object.fromEntries(positions),
    tokenMeaning: `1 tile = ${allocationAmount(model.quantum.minorUnits, model.quantum)}`,
  };
}
