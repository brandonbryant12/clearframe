// Fill-in-the-blank pictures for what workplace narration keeps saying (clearframe-workplace).
// A number said as a figure or in words ("60", "$3,300", "sixty", "thirty-five").
export const NUM = String.raw`(\$?\d[\d,.]*|(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|ten|eleven|twelve|\w+teen|hundred)(-\w+)?)`;

// Small counts too, for shares ("one in four").
export const COUNT = String.raw`(\$?\d[\d,.]*|(one|two|three|four|five|six|seven|eight|nine|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|ten|eleven|twelve|\w+teen|hundred)(-\w+)?)`;

export const UNIT = String.raw`( (days?|weeks?|months?|years?|dollars?|percent|hours?))?`;

// (Not a contribution that changes: "raise it to five and they add four" is the match's what-if.)
export const CHANGED = new RegExp(
  '^(?!.*\\b(match(es)?|adds?|puts? in|contribut\\w*)\\b).*(?:' +
    [
      `\\b${NUM}${UNIT}( \\w+){0,3},? (not|instead of|down from|up from) ${NUM}\\b`,
      `\\b(cut|shorten|reduc|rais|increas|extend|lower|chang|mov|drop|ris|doubl|went|go)\\w* (\\w+ ){0,4}from ${COUNT}${UNIT} (down |up )?to ${COUNT}\\b`,
      `\\b(was|used to be) ${COUNT}${UNIT}[^.!?]{0,40}\\bnow\\b`,
      `\\b${NUM}${UNIT}( \\w+){0,4},? (becomes?|goes (up|down) to|rises to|falls to) (a |an )?${NUM}\\b`,
    ].join('|') +
    ')',
  'i',
);
