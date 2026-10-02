import { still, group, poly, line, wash, gradient, round, jitter } from './_material-kit.mjs';
import { studyFrame } from './_art-study-kit.mjs';

// A sheet is four joined bands, not an opaque rectangle with a painted fake hole.
// The opening really reveals every layer behind it, in any palette.
const cutSheet = (x, y, w, h, inset, notch, fill) => {
  const outer = [[x, y], [x + w - notch, y], [x + w, y + notch], [x + w, y + h], [x, y + h]],
    inner = [[x + inset, y + inset], [x + w - inset - notch * 0.55, y + inset],
      [x + w - inset, y + inset + notch * 0.55], [x + w - inset, y + h - inset], [x + inset, y + h - inset]];
  return group(outer.map((p, i) => poly([p, outer[(i + 1) % 5], inner[(i + 1) % 5], inner[i]], fill)), {
    shadow: { dx: 3, dy: 9, blur: 12, opacity: 0.16, color: 'ink' },
  });
};

export default {
  name: 'die-cut-aperture', order: 40,
  summary: 'Offset die-cut paper windows expose a coloured core; the front sheet slips aside while the cut edges keep their depth.',
  use: 'Editorial reveals, chapter turns and product framing. Leave copy left in landscape or above in vertical; the aperture can frame a separately authored object or approved image.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = studyFrame(w, h), j = jitter(seed),
      pw = m * (0.62 + j(0.018)), ph = m * (0.71 + j(0.022)),
      x = cx - pw / 2 + j(m * 0.012), y = cy - ph / 2 + j(m * 0.012),
      inset = m * (0.077 + j(0.006)), notch = m * 0.09, step = m * 0.032;
    const sheets = [
      cutSheet(x + step * 1.6, y - step * 1.7, pw, ph, inset * 1.08, notch, 'accent2'),
      cutSheet(x + step * 0.8, y - step * 0.85, pw, ph, inset, notch, gradient(['surface', 'bg'], 30)),
      cutSheet(x, y, pw, ph, inset * 0.94, notch, gradient(['bg', 'surface'], 120)),
    ];
    sheets[2].children.push(line([x + pw - notch, y], [x + pw, y + notch],
      { stroke: 'ink', width: m * 0.002, opacity: 0.17 }));
    sheets[2].keys = [
      { at: 0, dur: 3.6, x: -round(m * 0.13), y: round(m * 0.02), ease: 'inOut', hold: false },
      { at: 3.6, dur: 1.3, x: -round(m * 0.12), y: round(m * 0.018), ease: 'inOut', hold: false },
    ];
    return { layer: 'under', elements: [
      wash(cx + m * 0.06, cy + ph * 0.52, pw * 0.72, m * 0.07, 'ink', 0.12),
      group([
        still('rect', { x: round(x + inset), y: round(y + inset), w: round(pw - inset * 2), h: round(ph - inset * 2),
          fill: gradient(['accent', 'accent2'], 120), stroke: 'none' }),
        // The diagonal insert is a physical slip of paper visible through every window.
        poly([[x + inset, y + ph * 0.59], [x + pw - inset, y + ph * 0.38],
          [x + pw - inset, y + ph - inset], [x + inset, y + ph - inset]], 'accent', { opacity: 0.8 }),
        ...sheets,
      ]),
    ] };
  },
};
