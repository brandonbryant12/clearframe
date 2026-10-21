import { round } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: { device?: string; expires?: boolean; send?: boolean };
}

// The same email, one different button: a message being written (To, Subject, a body line and
// an attached file, all there from the first frame) in a desktop mail window or a phone. The
// pointer reaches for the old button out of habit as the scene opens; on OLD that button is
// struck through and the attachment shakes and greys; on NEW the new button lights and is
// pressed; on LINK the file lights, lifts as it uploads and turns into a link chip with a lock;
// optionally a tag lands on the link (EXPIRES) and Send pulses with a confirmation (SEND). Each
// moment changes a large part of the picture on its word (a lit button, a lit chip, a solid
// tag), so it reads on a phone and in a pale palette. The window is crisp UI in any film look;
// the strike keeps the film's hand. Drawn, not a screenshot: it carries the product's words,
// never its figures.

/** A paperclip (no such icon in the set), drawn in a 24-unit box centred on (cx, cy). */
export const clipPath = (cx: number, cy: number, s: number) => {
  const P = (x: number, y: number) =>
      `${round(cx + ((x - 12) * s) / 24)} ${round(cy + ((y - 12) * s) / 24)}`,
    R = (r: number) => round((r * s) / 24);
  return `M ${P(15.5, 7)} L ${P(15.5, 16.5)} A ${R(3.5)} ${R(3.5)} 0 0 1 ${P(8.5, 16.5)} L ${P(8.5, 5.5)} A ${R(2.5)} ${R(2.5)} 0 0 1 ${P(13.5, 5.5)} L ${P(13.5, 15.5)} A ${R(1.5)} ${R(1.5)} 0 0 1 ${P(10.5, 15.5)} L ${P(10.5, 8)}`;
};

/** A paper plane for Send, in the same 24-unit box. */
export const planePath = (cx: number, cy: number, s: number) => {
  const P = (x: number, y: number) =>
    `${round(cx + ((x - 12) * s) / 24)} ${round(cy + ((y - 12) * s) / 24)}`;
  return `M ${P(21, 3)} L ${P(3, 10)} L ${P(10, 14)} L ${P(14, 21)} Z M ${P(21, 3)} L ${P(10, 14)}`;
};

export const cursorPath = (x: number, y: number, k: number) =>
  `M ${x} ${y} L ${x} ${round(y + 40 * k)} L ${round(x + 10 * k)} ${round(y + 31 * k)} L ${round(x + 17 * k)} ${round(y + 47 * k)} L ${round(x + 25 * k)} ${round(y + 44 * k)} L ${round(x + 18 * k)} ${round(y + 28 * k)} L ${round(x + 31 * k)} ${round(y + 28 * k)} Z`;
