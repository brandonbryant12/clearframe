import { tall, round } from '../../film/sketch-kit.mjs';

// Keeping things safe: five cards of someone's data (a file, a person, a message, a chart, a
// record) float free beside an open vault whose door stands edge-on. On GUARD they fly into the
// dark inside, shrinking as they go; on LOCK the door swings shut over them, the wheel turns, six
// bolts slide home and a ring of light settles around the door with its label.
const AT = { GUARD: 1.2, LOCK: 3.0 };
const ICONS = ['file', 'user', 'mail', 'chart-bar', 'database'];

function layout(w, h) {
  if (tall(w, h))
    return { vault: [540, 1220], R: 300, items: [[230, 470], [520, 400], [820, 480], [330, 690], [740, 700]], card: 150, label: [540, 1640], size: 52 };
  return { vault: [1290, 520], R: 270, items: [[260, 330], [560, 250], [340, 620], [640, 520], [470, 820]], card: 140, label: [1290, 930], size: 48 };
}

export default {
  name: 'vault',
  order: 75,
  summary:
    'Keeping things safe: cards of data float free beside an open vault; they fly into the dark inside, then the door swings shut over them, the wheel turns, bolts slide home and a ring of light settles round the door.',
  use: 'Security, privacy and trust: "your data stays yours", encryption, backups, compliance, a safe place for what matters. Solid and reassuring; works on light and dark palettes. Replace SAFE (the label under the vault) with sketchText; land GUARD and LOCK on words with sketchSay.',
  build(w, h) {
    const L = layout(w, h),
      [vx, vy] = L.vault,
      R = L.R,
      c = L.card;
    const bolts = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6, [ux, uy] = [Math.cos(a), Math.sin(a)];
      return {
        type: 'rect', x: round(vx + ux * (R - 46) - 22), y: round(vy + uy * (R - 46) - 22), w: 44, h: 44, r: 8, fill: 'bg', stroke: 'ink', width: 4,
        origin: [round(vx + ux * (R - 46)), round(vy + uy * (R - 46))],
        keys: [{ at: 0, x: round(-ux * 40), y: round(-uy * 40), dur: 0 }, { cue: 'LOCK', at: AT.LOCK, x: 0, y: 0, dur: 1.1, ease: 'inOut' }],
      };
    });
    return {
      elements: [
        // The vault: a heavy frame and the dark inside it (near-black on any palette: it is a hole).
        { type: 'circle', cx: vx, cy: vy, r: R + 50, fill: 'surface', stroke: 'ink', width: 8, shadow: { dx: 0, dy: 14, blur: 30, opacity: 0.25 }, enter: 'none', at: 0 },
        { type: 'circle', cx: vx, cy: vy, r: R, fill: { gradient: ['#05070b', '#1a1e27'], radial: true }, enter: 'none', at: 0 },
        // The data flies in, shrinking into the dark.
        ...L.items.map(([x, y], i) => ({
          type: 'group', enter: 'pop', at: 0.2 + i * 0.12, dur: 0.35, origin: [x, y], loop: { type: 'float', period: 2.4 + i * 0.3, amount: 8 },
          keys: [{ cue: 'GUARD', at: AT.GUARD, x: vx - x, y: vy - y, scale: 0.15, dur: round(0.8 + i * 0.12), ease: 'in' }],
          children: [
            { type: 'rect', x: x - c / 2, y: y - c / 2, w: c, h: c, r: 24, fill: i % 2 ? 'accent2' : 'accent', stroke: 'ink', width: 4 },
            { type: 'icon', name: ICONS[i], x, y, size: round(c * 0.5), fill: 'bg' },
          ],
        })),
        // The door stands open edge-on, then swings shut on LOCK; its wheel turns as it closes.
        {
          type: 'group', enter: 'none', at: 0, origin: [vx, vy],
          keys: [{ at: 0, tiltY: 86, dur: 0 }, { cue: 'LOCK', at: AT.LOCK, tiltY: 0, dur: 0.9, ease: 'out' }],
          children: [
            { type: 'circle', cx: vx, cy: vy, r: R - 6, fill: 'muted', stroke: 'ink', width: 8 },
            { type: 'circle', cx: vx, cy: vy, r: R - 70, fill: 'none', stroke: 'surface', width: 6, opacity: 0.5 },
            {
              type: 'group', origin: [vx, vy], keys: [{ cue: 'LOCK', at: AT.LOCK, rotate: 180, dur: 1.6, ease: 'inOut' }],
              children: [
                { type: 'circle', cx: vx, cy: vy, r: 92, fill: 'none', stroke: 'bg', width: 16 },
                ...[0, 60, 120].map(deg => {
                  const a = (deg * Math.PI) / 180;
                  return { type: 'line', x1: round(vx - Math.cos(a) * 92), y1: round(vy - Math.sin(a) * 92), x2: round(vx + Math.cos(a) * 92), y2: round(vy + Math.sin(a) * 92), stroke: 'bg', width: 12, cap: 'round' };
                }),
                { type: 'circle', cx: vx, cy: vy, r: 22, fill: 'bg' },
              ],
            },
          ],
        },
        // Six bolts slide home, and a ring of light settles round the closed door.
        { type: 'group', enter: 'fade', cue: 'LOCK', at: AT.LOCK, dur: 0.6, children: bolts },
        { type: 'circle', cx: vx, cy: vy, r: R + 24, fill: 'none', stroke: 'accent2', width: 10, glow: { blur: 24, opacity: 0.8 }, enter: 'draw', cue: 'LOCK', at: AT.LOCK, dur: 1.4 },
        { type: 'text', text: 'SAFE', x: L.label[0], y: L.label[1], size: L.size, font: 'semibold', fill: 'ink', anchor: 'middle', upper: true, tracking: 0.12, enter: 'fade', cue: 'LOCK', at: AT.LOCK, dur: 1.2 },
      ],
    };
  },
};
