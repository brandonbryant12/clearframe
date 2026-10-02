import { still, group, line, round, jitter } from './_material-kit.mjs';
import { studyFrame } from './_art-study-kit.mjs';

export default {
  name: 'moire-signal', order: 41,
  summary: 'Two coarse optical screens slowly change their relative angle, making broad interference bands inside a quiet instrument-like field.',
  use: 'Overlap, ambiguity, signals and competing readings. This is a synthetic optical texture, not an audio waveform or a measurement; keep native evidence outside the field.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = studyFrame(w, h), j = jitter(seed),
      pw = m * 0.63, ph = m * 0.68, x = cx - pw / 2 + j(m * 0.01), y = cy - ph / 2,
      count = 25, pitch = pw / (count - 1), bend = m * (0.047 + j(0.01)), phase = j(pitch * 0.2);
    const screen = (front = false) => Array.from({ length: count }, (_, i) => {
      const sx = x + i * pitch + (front ? phase : 0);
      return still('path', {
        d: `M ${round(sx)} ${round(y)} Q ${round(sx + (front ? bend : -bend))} ${round(cy)} ${round(sx)} ${round(y + ph)}`,
        fill: 'none', stroke: front ? 'accent' : 'accent2', width: round(m * 0.0065),
        opacity: front ? 0.7 : 0.36, cap: 'butt',
      });
    });
    const corners = [[x, y, 1, 1], [x + pw, y, -1, 1], [x, y + ph, 1, -1], [x + pw, y + ph, -1, -1]];
    return { layer: 'under', elements: [
      still('rect', { x: round(x - m * 0.04), y: round(y - m * 0.04), w: round(pw + m * 0.08), h: round(ph + m * 0.08),
        fill: 'surface', stroke: 'none', opacity: 0.58 }),
      group(screen()),
      group(screen(true), { origin: [round(cx), round(cy)], rotate: -3.5 + j(0.5),
        keys: [
          { at: 0, dur: 7.5, rotate: 3.5, ease: 'inOut', hold: false },
          { at: 7.5, dur: 7.5, rotate: -3.5, ease: 'inOut', hold: false },
        ],
      }),
      // Four registration corners suggest a material screen; there are no invented axes.
      group(corners.flatMap(([a, b, dx, dy]) => [
        line([a, b + dy * m * 0.032], [a, b], { stroke: 'muted', width: m * 0.0025, opacity: 0.75 }),
        line([a, b], [a + dx * m * 0.032, b], { stroke: 'muted', width: m * 0.0025, opacity: 0.75 }),
      ])),
    ] };
  },
};
