import { buildDrawdown } from './drawdown/build.mjs';
export default {
  name: 'drawdown',

  keep: true,

  order: 103,

  summary:
    'A sharp fall and the recovery, from the stated points only: a time axis in real days, the start on a 0% line, a dashed straight line down to the low with the stated fall in a chip, an optional pin on the day something was done (a rebalance), and an optional dashed climb back to 0%. No invented path, no fills.',

  use: 'A market letter\'s drawdown, a fund\'s quarter, any "fell X% from one date to another, then recovered": "shares fell 6.4% from August 4 to August 19; the next day we rebalanced, buying shares; by September 12 they were back". Set sketchParams from the letter, e.g. {start: "2027-08-04", low: "2027-08-19", drop: 6.4, act: "2027-08-20", back: "2027-09-12"}: start, low, act and back are days written YYYY-MM-DD; act (the day something was done) and back (the day it was back where it started) are optional, and "" (their default) draws no pin and no recovery, so never set one the source does not state. drop is the stated fall as a positive percent (6.4 for a 6.4% fall), printed with decimals as the source prints it; from and to set the time axis ("" takes the calendar quarter or quarters around the days). The axis shows real months, the only figure drawn is the fall (and the start\'s 0%), and every day on screen is printed from its param. Replace TITLE (what the line measures, e.g. "Shares in the balanced portfolio"), SUBTITLE (e.g. "Change in value since August 4, 2027"), with act ACTLABEL (up to about 18 characters, e.g. "Rebalanced Aug 20") and ACTNOTE (e.g. "bought shares"), and with back BACKLABEL (up to about 15 characters, e.g. "Back by Sep 12") with sketchText; "" removes a line. Land OPEN (the axis, then the start), FALL (the line falls to the low), LOW (the chip with the fall: the spoken figure is a good word), ACT (with act: the pin rises) and RECOVER (with back: the line climbs back) on words in that order with sketchSay; ACT and RECOVER follow their days (an action after the recovery comes after RECOVER). Each move lasts one to two seconds: words more than about two and a half seconds apart leave the picture still between them. The fall needs a visible source like any figure. For a value that holds while the market moves, use hold; for a whole series of real observations, canvas props.plot (docs/quantitative-plots.md).',

  params: {
    start: {
      default: '2027-08-04',
      figure: false,
      about:
        'the day the fall is measured from (the 0% point), written YYYY-MM-DD',
    },
    low: {
      default: '2027-08-19',
      figure: false,
      about: 'the day of the low, written YYYY-MM-DD',
    },
    drop: {
      default: 6.4,
      min: 0.01,
      max: 100,
      about:
        'the stated fall from start to low, in percent (6.4 for a 6.4% fall)',
      hint: 'A positive percent: a fall of 6.4% is 6.4 (not −6.4, and not 0.064).',
    },
    act: {
      default: '',
      figure: false,
      about:
        'the day something was done (a rebalance, a purchase), written YYYY-MM-DD: adds the ACT moment (a pin raised from the line) and the words ACTLABEL and ACTNOTE; "" for none',
    },
    back: {
      default: '',
      figure: false,
      about:
        'the day it was back where it started, written YYYY-MM-DD: adds the RECOVER moment (the climb back to 0%) and the words BACKLABEL; "" when the source does not say',
    },
    from: {
      default: '',
      figure: false,
      about:
        'the first day on the time axis, YYYY-MM-DD ("" for the start of the quarter the dates begin in)',
    },
    to: {
      default: '',
      figure: false,
      about:
        'the last day on the time axis, YYYY-MM-DD ("" for the end of the quarter the dates end in)',
    },
    decimals: {
      default: 1,
      min: 0,
      max: 3,
      integer: true,
      figure: false,
      about:
        'decimal places in the printed fall, as the source prints it (1 for −6.4%)',
    },
  },
  build: buildDrawdown,
};
