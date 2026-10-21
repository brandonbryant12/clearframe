import { round } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    marks?: string[];
    attachment?: boolean;
    color?: string;
    report?: boolean;
    choices?: boolean;
    start?: string;
    end?: string;
  };
}

// Look closely at a message: an email card arrives (sender, subject, two body lines, a link
// button and, if asked, an attachment), then up to three of its parts are marked in turn. Each
// mark rings the part, draws a connector out to a short label and the view leans in on it: the
// labels stand beside the card in wide frames and just under their part in narrow ones (the
// marks are known when the card is laid out, so the room for them is there from the start).
// Which part each mark points at is a param, so one drawing serves phishing tells, a receipt's
// must-haves or the clause to check. Moments: OPEN (the card arrives), then ONE, TWO, THREE.
// With `report`, the same message carries a Report phish button in a toolbar along its top from
// the first frame, and a last moment, REPORT, does the habit on it: the view settles, the pointer
// reaches the button, which lights solid and is pressed; the marks fade, a shield pops up and the
// whole message shrinks into it, the shield pulses and a confirmation pops up under it. Every step
// is a solid change over a large part of the frame, so it reads on a phone and in a pale palette.
// With `choices`, the two wrong moves come first, on the same card: on CLICK the pointer reaches
// the link, the card is tugged and a no sign lands on the button; on DELETE it reaches a bin in
// the toolbar, the card starts to fold into it and a no sign lands on the bin; then REPORT.
// One card across two beats: the first ends after the marks (`end: "marked"`: the toolbar is
// drawn, the later moments are left out) and the second opens on the card as it stands then
// (`start: "marked"`), so only CLICK, DELETE and REPORT remain to cue.
export const PARTS = ['sender', 'subject', 'body', 'link', 'attachment'];

export const NAMES = ['ONE', 'TWO', 'THREE'] as const;

export const LABELS = ['MARKONE', 'MARKTWO', 'MARKTHREE'];

export const ICON = {
  negative: 'alert',
  positive: 'check',
  accent: 'search',
  accent2: 'search',
};

export const AT = {
  OPEN: 0.3,
  ONE: 1.8,
  TWO: 3.5,
  THREE: 5.2,
};

// REPORT's default second: this long after the last mark (its label has landed by then).
export const REPORT_AFTER = 1.9;

// With choices, CLICK takes REPORT's place and DELETE and REPORT follow this far apart.
export const CHOICE_GAP = 1.5;

// CLICK and DELETE, in seconds after the moment: the pointer reaches the control and presses it
// as the card reacts, then the no sign lands (quick: "don't just delete it. Report it" leaves
// under a second between the words).
export const CHOICE = { reach: 0.4, sign: 0.5 };

// In a beat that opens on the marked card, the first moment left comes this soon after the cut.
export const RESUME_AT = 0.5;

// The moments a marked card has had, and the ones that follow them.
export const SHOWN = new Set(['OPEN', ...NAMES]);

export const LATER = new Set(['CLICK', 'DELETE', 'REPORT']);

export const cursorPath = (x: number, y: number, k: number) =>
  `M ${x} ${y} L ${x} ${round(y + 40 * k)} L ${round(x + 10 * k)} ${round(y + 31 * k)} L ${round(x + 17 * k)} ${round(y + 47 * k)} L ${round(x + 25 * k)} ${round(y + 44 * k)} L ${round(x + 18 * k)} ${round(y + 28 * k)} L ${round(x + 31 * k)} ${round(y + 28 * k)} Z`;
