import { WEEK } from './deadline/constants.mjs';
import { buildSketch } from './deadline/build.mjs';

export default {
  name: 'deadline',
  keep: true,
  // Weekday headers are real words: replace them only to shorten or translate.
  keepText: WEEK,
  // Today's ring stands on its own: it may land before the window opens or after it closes.
  freeMoments: ['TODAY'],
  order: 93,
  summary:
    'A window on a calendar: the month draws, the opening day is marked, the window sweeps across the weeks to the last day, which is circled by hand, and the days outside it fall back. Optional "today" ring; a key says what each mark means.',
  use: 'Open enrollment, an election or claim window, a filing deadline, a grace period: "enrollment opens November 4 and closes the 18th". Set the month and window with sketchParams {days, firstWeekday, start, end, today} (today 0 = none); replace MONTH (e.g. "November 2027"), OPENS (e.g. "Enrollment opens"), CLOSES (e.g. "Last day to choose") and, with a today, TODAY (e.g. "Today") with sketchText; SUN … SAT are the weekday headers (keep them, shorten them or translate them). Land OPEN, CLOSE and, with a today, TODAY on words with sketchSay. The dates need a visible source.',
  params: {
    days: {
      default: 30,
      min: 28,
      max: 31,
      integer: true,
      figure: false,
      about: 'days in the month',
    },
    firstWeekday: {
      default: 1,
      min: 0,
      max: 6,
      integer: true,
      figure: false,
      about: 'weekday of the 1st, 0 = Sunday … 6 = Saturday',
    },
    start: {
      default: 4,
      min: 1,
      max: 31,
      integer: true,
      about: 'first day of the window',
    },
    end: {
      default: 18,
      min: 1,
      max: 31,
      integer: true,
      about: 'last day of the window (circled)',
    },
    today: {
      default: 0,
      min: 0,
      max: 31,
      integer: true,
      about: 'a day to mark as today, or 0 for none',
    },
  },
  build: buildSketch,
};
