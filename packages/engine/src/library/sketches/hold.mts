import { buildHold } from './hold/build.mjs';
export default {
  name: 'hold',

  keep: true,

  order: 98,

  summary:
    'A value held while the market moves: a locked level line with a padlock and its value runs across a time window; the market wanders off from the same start and climbs above it, and the gap shades in as what the lock keeps. Optional fall below the lock, with a float-down step.',

  use: 'A mortgage rate lock, a price lock, a fixed rate against a variable one, a guaranteed rate or premium: "your rate is locked at 6.25% for 45 days; if rates rise to 6.85%, you keep 6.25%". Set the figures with sketchParams {lock, rise, fall, floatDown, days, prefix, suffix, decimals}: rise and fall are distances from the lock in the same units (a market at 6.85% against a 6.25% lock is rise 0.6), fall 0 draws no fall, floatDown true steps the lock down to the market\'s low. Replace LOCKED (the lock line, e.g. "Your locked rate"), MARKET (the moving line, e.g. "Market rate"), WINDOW (under the day axis, e.g. "Days since you lock") and KEPT (words after the gap, up to about 24 characters, e.g. "below the market") with sketchText; land LOCK, RISE, FALL (with a fall) and END (the window closes) on words with sketchSay. The figures need a visible source like any number.',

  params: {
    lock: {
      default: 6.25,
      min: 0,
      max: 1000000,
      about: 'the locked value, in the printed units (6.25 for a 6.25% rate)',
    },
    rise: {
      default: 0.6,
      min: 0.01,
      max: 1000000,
      about: 'how far the market climbs above the lock, in the same units',
      hint: 'A distance above the lock, not the new level: for a market at 6.85% against a 6.25% lock, rise is 0.6 (not 6.85).',
    },
    fall: {
      default: 0,
      min: 0,
      max: 1000000,
      about:
        'then how far the market drops below the lock, in the same units (0 for no fall)',
      hint: 'A distance below the lock, not the new level: for a market at 5.9% against a 6.25% lock, fall is 0.35 (not 5.9).',
    },
    floatDown: {
      default: false,
      about:
        'true: when the market falls, the locked line steps down once to meet its low (a float-down option)',
    },
    days: {
      default: 45,
      min: 2,
      max: 730,
      integer: true,
      about: 'length of the window, in days',
    },
    prefix: {
      default: '',
      about:
        'printed before each value, e.g. "$" for a price lock (or "" for none)',
    },
    suffix: {
      default: '%',
      about: 'printed after each value, e.g. "%" (or "" for none)',
    },
    decimals: {
      default: 2,
      min: 0,
      max: 4,
      integer: true,
      about: 'decimal places in the printed values (2 for 6.25%)',
    },
  },
  build: buildHold,
};
