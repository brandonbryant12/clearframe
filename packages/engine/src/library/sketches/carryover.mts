import { buildSketch } from './carryover/build.mjs';

export default {
  name: 'carryover',
  keep: true,
  order: 96,
  summary:
    'What carries into next year and what does not: this year’s elections beside next year’s empty slots; each that carries over crosses the line on its word and is ticked, and one that does not hits the line and comes back while what it becomes ("$0") lands in its slot; with bookend the board opens where that left it and the card that stayed crosses too.',
  use: 'Open enrollment and plan-year rules: "do nothing and your medical, dental and vision carry over, but your FSA election resets to $0". Set sketchParams {count, stays, icons}: count cards (2–5), stays the 1-based numbers of the cards that do not carry over, icons optional icon names per card (see icons); replace BEFORE (e.g. "This year"), AFTER (e.g. "From January 1"), ITEM1 … ITEMn (e.g. "Medical") and RESET (what a card that stays becomes, a word or two, e.g. "$0" or "Lapses") with sketchText; land CARD1 … CARDn and RESET on words with sketchSay. The reset chips carry ids (carryover-reset-N) for an into. To close the film on the same board, give the closing beat the same params and words plus bookend: true: it opens with the cards where the hook left them, and on FIX (land it on the word that fixes it, "re-elect") the reset chip clears, and on CROSS (e.g. "all four") the card that stayed crosses and is ticked.',
  params: {
    count: {
      default: 4,
      min: 2,
      max: 5,
      integer: true,
      figure: false,
      about: 'how many elections (cards)',
    },
    stays: {
      default: [4],
      list: true,
      length: [1, 4],
      min: 1,
      max: 5,
      integer: true,
      figure: false,
      about: 'the 1-based numbers of the cards that do not carry over',
    },
    icons: {
      default: [],
      about: 'optional icon names, one per card (see icons)',
    },
    bookend: {
      default: false,
      about:
        'true opens with the board decided (carried cards across, the reset chip in the slots of the cards that stayed); on FIX the chip clears and on CROSS those cards cross and are ticked',
    },
  },
  build: buildSketch,
};
