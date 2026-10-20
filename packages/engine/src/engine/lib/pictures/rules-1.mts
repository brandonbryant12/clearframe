import { drawdownLine, carryoverLine } from './matchers.mjs';
import type { PictureRule } from './contracts.mjs';
import { CHANGED } from './patterns.mjs';
export const RULES_1: readonly PictureRule[] = [
  // Before the deadline and the comparisons below: a rule's number that changed ("30 days, not 60").
  [
    CHANGED,
    'was-now',
    'This line says a number changed: what it was and what it is now',
  ],

  // A small amount every period and what it comes to ("$6 more a paycheck… $156 a year").
  [
    [
      /\beach (paycheck|pay ?period|pay ?check|month|week)\b[^.]*[.,]?[^.]*\b(a year|per year|annually|in a year|all year|comes to|adds up)\b/i,
      /\bevery (paycheck|pay ?period|pay ?check|month|week)\b[^.]*[.,]?[^.]*\b(a year|per year|annually|in a year|all year|comes to|adds up)\b/i,
      /\bper (paycheck|pay ?period|pay ?check|month|week)\b[^.]*[.,]?[^.]*\b(a year|per year|annually|in a year|all year|comes to|adds up)\b/i,
      /\ba (paycheck|pay ?period|pay ?check|month|week)\b[^.]*[.,]?[^.]*\b(a year|per year|annually|in a year|all year|comes to|adds up)\b/i,
    ],
    'every',
    'This line is a small amount every period and what it comes to',
  ],

  // Before the comparison below: a price taken as the lower of two, then a discount (a share plan's lookback).
  [
    [
      /\blower of (the )?(two|both)\b/i,
      /\blower of (the )?(\w+ ){0,2}(price|prices|values?)\b/i,
      /\bwhichever (\w+ ){0,3}(is |was )?(lower|cheaper)\b/i,
      /\blook-?back\b/i,
      /\b(percent|%) (off|below|less than) the lower\b/i,
    ],
    'lookback',
    'This line takes the lower of two prices, then a discount',
  ],

  // Before the comparison below: a sharp fall between two dates and the recovery (a market letter's drawdown).
  [
    drawdownLine,
    'drawdown',
    'This line is a sharp fall between two dates (and the recovery)',
  ],

  [
    [
      /\b(lower|higher|lowest|highest|cheaper) of (the )?(two|both)\b/i,
      /\bwhichever (\w+ ){0,3}(is |was )?(lower|higher|cheaper)\b/i,
      /\bstarts? at .* (ends?|goes) (at|to)\b/i,
    ],
    null,
    'This line compares prices or values over time',
    'a canvas `chart` `bars` with a `say` on each value as it is said (the start, the end, what you pay), the one that counts highlighted',
  ],

  // Before expire, portal and choose: "instead of Attach, press Share securely… it expires in 7 days" is one email, one different button.
  [
    [
      /\binstead of (attach(ing)?|forward(ing)?)\b/i,
      /\bshare (it |them |files? )?securely\b/i,
      /\bsecure(ly)? (link|share)\b/i,
      /\bone different button\b/i,
      /\bsame (email|message),? (with |but )?(one|a) different\b/i,
      /\b(press|click|tap|hit|use) (the )?(encrypt|share securely)\b/i,
      /\bencrypt (it |them )?before\b/i,
      /\blinks? (\w+ ){0,4}expires?\b/i,
      /\bexpir\w* (\w+ ){0,4}(the |a |its )?links?\b/i,
      /\b(not|never) as (an )?attachments?\b/i,
    ],
    'compose',
    'This line is the same email with one different button',
  ],

  // Before expire: elections that carry into next year (and the one that does not), not money that is lost.
  [
    carryoverLine,
    'carryover',
    'This line says which elections carry into next year and which do not',
  ],

  [
    /\b(carr(y|ies) over|use it or lose it|forfeit|resets? to (zero|\$?0)|expires?|lose (it|the rest))\b/i,
    'expire',
    'This line is about what carries over and what is lost',
  ],

  // Before match: the employer's money landing in your account (an HSA seed, a grant), not a match on yours.
  [
    [
      /\b(puts?|deposits?)\b[^.]{0,40}\b(into|to|in) your (hsa|health savings|savings|account|fund)/i,
      /\b(adds?|contributes?)\b[^.]{0,40}\b(into|to|in) your (hsa|health savings|savings|account|fund)/i,
      /\b(seeds?|credits?)\b[^.]{0,40}\b(into|to|in) your (hsa|health savings|savings|account|fund)/i,
    ],
    'deposit',
    'This line is money the employer puts into your account',
  ],
];
