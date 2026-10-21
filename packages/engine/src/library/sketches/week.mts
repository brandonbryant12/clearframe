import { WEEK } from './week/common.mjs';
import { buildWeek } from './week/build.mjs';
export default {
  name: 'week',

  keep: true,

  // Day names are real words: replace them only to shorten, translate or date them.
  keepText: WEEK,

  // Today's marker stands on its own: "starting today" may come before or after the tasks.
  freeMoments: ['TODAY'],

  order: 100,

  summary:
    'One working week: today is marked, up to four task cards drop into the days they belong to, the due day is circled by hand with a short label, and an optional muted card past the week’s edge says what slips if the day is missed.',

  use: 'Onboarding and "due this week" lines that name days, not dates: "three small things by Friday", "finish the training before you serve members", "your first pay is on the 15th; miss Friday and it\'s the 30th". Set the week with sketchParams {days, today, due, tasks, after}: days 5 (Mon–Fri) or 7 (with the weekend); today and due are day indices (0 = MON … 4 = FRI, 5 = SAT, 6 = SUN); tasks gives each task\'s day in the order they are said (1–4, none after due); after true adds the consequence card. Replace TASK1 … (two to five words each), DUE (e.g. "Due Friday"), TODAY (e.g. "Today") and, with after, AFTER (a few words, e.g. "Miss it: paid on the 30th") with sketchText; MON … SUN are the day names (keep them, shorten or translate them). Land ONE … FOUR (each task, best on the word that names its day: "Monday, set up direct deposit"), DUE ("All by Friday") and AFTER ("Miss it") on words in that order, and TODAY on any word, with sketchSay; a long run-up before the first task ("three small things by Friday") leaves the week still while the voice talks. For a window across a month, use deadline.',

  params: {
    days: {
      default: 5,
      oneOf: [5, 7],
      figure: false,
      about: 'days drawn: 5 (MON–FRI) or 7 (with SAT and SUN)',
    },
    today: {
      default: 0,
      min: 0,
      max: 6,
      integer: true,
      figure: false,
      about: 'the start day, marked TODAY: 0 = MON … 4 = FRI, 5 = SAT, 6 = SUN',
    },
    due: {
      default: 4,
      min: 0,
      max: 6,
      integer: true,
      figure: false,
      about: 'the due day, circled: 0 = MON … 4 = FRI, 5 = SAT, 6 = SUN',
    },
    tasks: {
      default: [0, 1, 3],
      list: true,
      length: [1, 4],
      min: 0,
      max: 6,
      integer: true,
      figure: false,
      about:
        'the day of each task, in the order they are said (1–4 tasks, none after due; two may share a day)',
      hint: 'Each value is a day index, not a date: 0 = MON … 4 = FRI.',
    },
    after: {
      default: false,
      about:
        'true: on AFTER, a muted card past the week’s edge says what happens if the day is missed',
    },
  },
  build: buildWeek,
};
