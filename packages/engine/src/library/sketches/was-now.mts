import { buildSketch } from './was-now/build.mjs';

export default {
  name: 'was-now',
  keep: true,
  order: 94,
  summary:
    "A rule's number changes: the old window drawn to scale, then the part that no longer counts falls away (or the new part grows on), the old end is struck and the new one lands. Was 60 days, now 30.",
  use: 'A policy change people must notice: "you now have 30 days to claim, not 60", a waiting period shortened, a limit raised. Set sketchParams {was, now, prefix, suffix, decimals, note}; replace WHAT (what the number is, e.g. "Time to submit an expense claim"), WASLABEL (e.g. "until now"), NOWLABEL (e.g. "from January 1") and, with note: true, NOTE (what happens in the part that changed, e.g. "After day 30, a director approves") with sketchText; land CHANGE (and NOTE) on words with sketchSay. For a line that names the old figure first ("$150 a paycheck becomes $156"), start: "empty" opens on the bare scale and grows the old window from zero on WAS (land it on the old figure’s word), so the line’s first half moves too. Both numbers need a visible source.',
  params: {
    was: {
      default: 60,
      min: 0.01,
      max: 1e9,
      about: 'the old number (the old end of the window)',
    },
    now: { default: 30, min: 0.01, max: 1e9, about: 'the new number' },
    prefix: { default: '', about: 'printed before each number, e.g. "$"' },
    suffix: {
      default: ' days',
      about: 'printed after each number, e.g. " days"',
    },
    decimals: {
      default: 0,
      min: 0,
      max: 2,
      integer: true,
      about: 'decimals the source prints',
    },
    note: { default: false, about: 'draw NOTE in the part that changed' },
    start: {
      default: 'drawn',
      oneOf: ['drawn', 'empty'],
      about:
        'drawn: the old window is there from the first frame; empty: it grows from zero on WAS, with its number and label',
    },
  },
  build: buildSketch,
};
