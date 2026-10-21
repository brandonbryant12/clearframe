import { buildInspect } from './inspect/build.mjs';
export default {
  name: 'inspect',

  order: 95,

  keep: true,

  summary:
    'Look closely at a message: an email card arrives, then up to three of its parts are ringed in turn, each with a connector out to a short label, and the view leans in on each mark; optionally the same message is then reported, its Report phish button pressed and the message shrinking into a security shield with a confirmation (after a refused click and a refused delete, with choices), in the same beat or in a second beat on the same card.',

  use: 'Phishing tells (an urgent subject, an almost-right sender, an unexpected link), a receipt’s or payslip’s must-haves, the line in a notice to check. Replace FROM (the sender line, up to about 40 characters), SUBJECT (up to about 40), LINE1 and LINE2 (two short body lines), BUTTON (the link’s words), FILE (the attachment’s name, when drawn) and MARKONE, MARKTWO, MARKTHREE (the labels, two to four words each) with sketchText; land OPEN (the card arriving) and ONE, TWO, THREE (one per mark) on words with sketchSay. sketchParams: marks (which part each mark rings, in order: sender, subject, body, link or attachment), attachment (true draws the attachment chip), color (negative for warning signs, positive for what to look for, accent for points of interest) and report. For phishing training, report true makes the action the same email instead of a slide: the message carries a Report phish button in its toolbar from the first frame (fill REPORTBUTTON, one or two words, e.g. "Report phish") and a last moment, REPORT, comes after THREE (the order is OPEN, ONE, TWO, THREE, REPORT): on it the pointer presses the button, which lights; the marks fade, the message shrinks into a security shield and a confirmation pops up (fill REPORTED, up to about 30 characters, e.g. "Reported to Security. Thanks."). Land REPORT on the word that says the action ("report"). For "don’t click, don’t just delete, report", choices true (with report) adds a bin to the toolbar and two moments between THREE and REPORT (the order is OPEN, ONE, TWO, THREE, CLICK, DELETE, REPORT): on CLICK the pointer presses the link, the card is tugged and a no sign lands on the button; on DELETE it presses the bin, the card starts to fold into it and a no sign lands on the bin. Land them on "click" and "delete". To give the signs and the habit a beat each on one card, give both beats the same sketchParams plus end "marked" on the first (it stops after THREE, toolbar already drawn) and start "marked" on the second (it opens on the marked card, so its moments are only CLICK, DELETE and REPORT), transition "cut" on the second and camera "none" on the first (the default slow push would leave the card larger than the second beat opens on it).',

  params: {
    marks: {
      default: ['subject', 'sender', 'link'],
      list: true,
      length: [1, 3],
      about:
        'the part each mark rings, in order: sender, subject, body, link or attachment (1–3, each once)',
    },
    attachment: {
      default: false,
      about:
        'true draws an attachment chip (fill FILE); marking "attachment" draws it too',
    },
    color: {
      default: 'negative',
      about:
        'colour of the marks: negative (warning signs), positive (what to look for), accent or accent2',
    },
    report: {
      default: false,
      about:
        'true adds the Report phish step: a REPORTBUTTON button in the message’s toolbar from the first frame, and a last moment, REPORT, after the marks (order OPEN → ONE → TWO → THREE → REPORT), on which the pointer presses the button, the marks fade, the message shrinks into a security shield and a confirmation (REPORTED) pops up',
    },
    choices: {
      default: false,
      about:
        'true (with report) does "don’t click, don’t just delete, report" on the same email: a bin joins the toolbar and two moments come before REPORT (order OPEN → ONE → TWO → THREE → CLICK → DELETE → REPORT): on CLICK the pointer reaches the link, the card is tugged and a no sign lands on the button; on DELETE it reaches the bin, the card starts to fold into it and a no sign lands on the bin',
    },
    start: {
      default: 'open',
      oneOf: ['open', 'marked'],
      about:
        'open (the default): the card arrives on OPEN. marked (with report): a second beat on the same card: it stands from the first frame with its marks and labels drawn and the view leaning in as after THREE, so only CLICK, DELETE (with choices) and REPORT remain to cue (order CLICK → DELETE → REPORT). Give the beat before it the same sketchParams with end "marked" and camera "none", and cut between them',
    },
    end: {
      default: 'last',
      oneOf: ['last', 'marked'],
      about:
        'last (the default): the beat runs to its last moment. marked (with report): the beat ends after THREE with the report toolbar (and the bin, with choices) already drawn, leaving CLICK, DELETE and REPORT to the next beat (start "marked", the same sketchParams otherwise), so the card is the same on both sides of the cut; give this beat camera "none" so the default push does not enlarge it',
    },
  },
  build: buildInspect,
};
