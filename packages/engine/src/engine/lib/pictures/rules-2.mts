import type { PictureRule } from './contracts.mjs';

export const RULES_2: readonly PictureRule[] = [
  [
    /\bvest(s|ed|ing)?\b|\byours to keep\b.*\byears?\b|\bafter (one|two|three|\d) years?\b/i,
    'vesting',
    'This line is about what becomes yours over time',
  ],

  [
    [
      /\bmatch(es|ing)?\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\badds?\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\bputs? in\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\bon top of\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\btop[- ]up\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\bcontributes? the same\b.*(\b(percent|dollars?)\b|[%$])/i,
      /\b(percent|%).*\b(match(es)?|adds?)\b/i,
    ],
    'match',
    'This line is about one contribution added to another',
  ],

  [
    /\b((by|before|on) (monday|tuesday|wednesday|thursday|friday)|this week|first week|by the end of the week)\b/i,
    'week',
    'This line names days of one week',
  ],

  [
    [
      /\bdeadline\b/i,
      /\bby (january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /\b(on|by) the \d{1,2}(st|nd|rd|th)\b/i,
      /\bbetween .* and .*\b\d{1,2}\b\b/i,
      /\bopen enrollment runs\b/i,
      /\bwithin \d+ days\b/i,
      /\b\d+ days (from|after|to)\b/i,
      /\blast day\b/i,
    ],
    'deadline',
    'This line names a window or a deadline',
  ],

  // A receipt added to a claim: the paper itself, and its photo landing in the app.
  [
    /\b(photograph|upload|attach|snap|scan|add)\w* (the |a |your |an itemi[sz]ed )?(itemi[sz]ed )?receipts?\b/i,
    null,
    'This line adds a receipt to a claim',
    'the canvas `receipt` beside an `app` whose `upload` slot takes the same lines, its photo landing on the word, and the amount typing in (examples/expense-policy)',
  ],

  // The Report step on a suspicious message: the same email the signs were marked on, its button pressed.
  [
    [
      /\breport (phish|phishing|it|the (e-?mail|message))/i,
      /\b(press|click|tap|hit|use)(es|ing)? (the )?report\b/i,
      /\breport (phish )?button/i,
    ],
    'inspect',
    'This line is the Report step on a suspicious message (`report: true` presses Report on the same email and sends it to Security)',
  ],

  // "Emails go to the wrong inbox" is not a step in an app: go to names a place in one.
  [
    [
      /\b(log ?in|sign(ed)? in|portal|open the app|in the app)\b/i,
      /\b(click|tap|select|toolbar|button)\b/i,
      /\bgo to (the |your )?(\w+ ){0,2}(portal|app|site|page|settings|menu|tab|screen|website)\b/i,
    ],
    'portal',
    'This line is a step done in an app',
  ],

  [
    /\b(look for|signs\b|sign of|tells?|red flags?|watch for|check (the|for)|itemi[sz]ed)\b/i,
    'inspect',
    'This line points at parts of a message or document',
  ],

  [
    /\b(or the|versus|vs\.?|compared? (to|with)|which one|either|instead of)\b/i,
    'choose',
    'This line compares two options',
  ],
];
