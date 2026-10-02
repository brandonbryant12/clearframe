import { still, group, poly, line, wash, gradient, round, jitter } from './_material-kit.mjs';
import { studyFrame } from './_art-study-kit.mjs';

export default {
  name: 'folded-louvers', order: 42,
  summary: 'A bank of folded architectural fins opens on fixed hinges, exposing a strip of light and long angular shadows.',
  use: 'A reveal, a change in perspective or a system opening access. Native planes suggest depth; use a true 3D render when the camera must travel around the fins.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = studyFrame(w, h), j = jitter(seed),
      pw = m * 0.69, ph = m * (0.62 + j(0.018)), x = cx - pw / 2 + j(m * 0.009), y = cy - ph / 2,
      count = 7, pitch = pw / count, fin = pitch * 0.78, fold = fin * 0.23;
    const panels = Array.from({ length: count }, (_, i) => {
      const a = x + pitch * i, stagger = i * 0.08;
      return group([
        poly([[a, y], [a + fin - fold, y - m * 0.018], [a + fin - fold, y + ph - m * 0.018], [a, y + ph]],
          gradient(['bg', 'surface'], 5), { stroke: 'muted', width: m * 0.0012, opacity: 0.98 }),
        poly([[a + fin - fold, y - m * 0.018], [a + fin, y], [a + fin, y + ph], [a + fin - fold, y + ph - m * 0.018]],
          gradient(['accent2', 'surface'], 0)),
        line([a + fin - fold, y - m * 0.018], [a + fin - fold, y + ph - m * 0.018], { stroke: 'bg', width: m * 0.0025, opacity: 0.8 }),
      ], { origin: [round(a), round(cy)], tilt: [0, 18 + j(3)],
        shadow: { dx: round(m * 0.017), dy: round(m * 0.011), blur: round(m * 0.012), opacity: 0.17, color: 'ink' },
        keys: [
          { at: stagger, dur: 3.1, tiltY: 67, ease: 'inOut', hold: false },
          { at: 3.7 + stagger, dur: 4.8, tiltY: 52, ease: 'inOut', hold: false },
        ],
      });
    });
    return { layer: 'under', elements: [
      wash(cx + m * 0.03, cy + ph * 0.57, m * 0.47, m * 0.07, 'ink', 0.14),
      still('rect', { x: round(x), y: round(y), w: round(pw), h: round(ph), fill: gradient(['accent', 'accent2'], 100), stroke: 'none', opacity: 0.55 }),
      ...Array.from({ length: count }, (_, i) => {
        const a = x + i * pitch;
        return poly([[a, y + ph], [a + fin * 0.35, y + ph], [a + fin + m * 0.09, y + ph + m * 0.12], [a + m * 0.09, y + ph + m * 0.12]], 'ink', { opacity: 0.08 });
      }),
      line([x - m * 0.025, y + ph], [x + pw + m * 0.025, y + ph], { stroke: 'muted', width: m * 0.01, opacity: 0.6 }),
      ...panels,
      line([x - m * 0.025, y], [x + pw + m * 0.025, y], { stroke: 'muted', width: m * 0.005, opacity: 0.6 }),
    ] };
  },
};
