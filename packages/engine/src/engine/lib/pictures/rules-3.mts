import type { PictureRule } from './contracts.mjs';
import { COUNT } from './patterns.mjs';
export const RULES_3: readonly PictureRule[] = [
  [
    [
      /\b(breaks? down|split|of your (pay|paycheck))\b/i,
      /\bwhere (your|the) money goes\b/i,
      /\btake[- ]home\b/i,
      /\bgoes (to|into) (your|the) (\w+ )?(account|fund|plan|savings|taxes|pension)\b/i,
    ],
    'split',
    'This line divides a whole into parts',
  ],

  [
    [
      /\bcompound(s|ing)?\b/i,
      /\bgrows? (to|over|every)\b/i,
      /\bstart(ing)? early\b/i,
      /\bover (\w+ )?(\d+|ten|twenty|thirty|forty) years\b/i,
      /\bby the time you retire\b/i,
    ],
    'growth',
    'This line is about money growing over years',
  ],

  [
    /\b(lock(ed|s)? (in|your)|rate lock|guarantee[ds]?|fixed (rate|price|premium)|whatever the market)\b/i,
    'hold',
    'This line is about a value that holds while the market moves',
  ],

  [
    /\b((one|two|three|four|five|six|\d+)( to (three|six|nine|twelve|\d+))? months? of)\b/i,
    null,
    'This line counts months',
    'a `cast` of `calendar` tiles, one per month, that appear as the months are said (docs/cast.md)',
  ],

  [
    /\b(inflation|buys? (about )?\w+ (percent )?less|loses? (value|purchasing power))\b/i,
    null,
    'This line is about money shrinking in value',
    'a canvas `chart` `number` that steps down through the values as they are said (a `say` on each), or a `jar` cast that empties a little on the word',
  ],

  [
    /\b(separate|its own account|a different account|set (it )?aside|out of sight)\b/i,
    null,
    'This line is about keeping money apart',
    'a `cast` with two `jar`s (or a `jar` and a `paycheck`): coins move into their own jar on the word',
  ],

  // Weeks of a year: "sixteen weeks of paid leave" is a share of the year's 52.
  [
    new RegExp(
      `\\b${COUNT} weeks? of (paid |unpaid |full-pay )?(leave|holiday|vacation|time off|parental leave)\\b`,
      'i',
    ),
    'share',
    'This line is weeks of a year (share with total 52, cols 13, unit "weeks")',
  ],

  // A share of people or things: "31 percent of expense claims", "one in four of us".
  [
    new RegExp(
      `\\b${COUNT}( percent|%| in (every )?${COUNT}| out of (every )?${COUNT}) of (the |our |all |your |every )?(\\w+ ){0,2}(us|you|people|employees|staff|members|colleagues|hires|claims|emails|messages|accounts|customers|clients|requests|applications|reports|returns|forms)\\b`,
      'i',
    ),
    'share',
    'This line is a share of people or things',
  ],

  // Last: a figure said out loud, whatever it is about.
  [
    [
      /\b(hundred|thousand|million|billion) (dollars|pounds|euros)\b/i,
      /\$\s?\d/i,
      /\b\w+ percent\b/i,
      /\d+(\.\d+)?%/i,
    ],
    null,
    'This line says a figure',
    'a canvas `chart` `number` that lands on the figure as it is said (a `say` on the value; several figures step through), with what it counts as its label',
  ],
];
