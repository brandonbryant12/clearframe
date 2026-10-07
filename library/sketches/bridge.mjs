import { tall, round } from '../../film/sketch-kit.mjs';

// Closing a gap: two cliffs face each other across a chasm, people on one side and the thing
// they need on the other. On BUILD planks drop into place one by one across the gap, two towers
// rise and the cables draw between them; on CROSS small cards start crossing, one after another,
// and keep crossing. Integration, partnership, access: the connection is built, then used.
const AT = { BUILD: 1.0, CROSS: 3.2 };

function layout(w, h) {
  if (tall(w, h))
    return { top: 1100, gapL: 340, gapR: 740, towerH: 240, people: [[200, 980]], peopleIcon: 'users', place: [880, 970], tile: 150, big: 150, labels: [[220, 870], [860, 870]], size: 44, fit: 230, planks: 8 };
  return { top: 640, gapL: 620, gapR: 1300, towerH: 260, people: [[230, 520], [370, 520], [510, 520]], peopleIcon: 'user', place: [1610, 500], tile: 110, big: 170, labels: [[370, 760], [1610, 760]], size: 44, fit: 460, planks: 12 };
}

export default {
  name: 'bridge',
  order: 76,
  summary:
    'Closing a gap: people on one cliff and what they need on the other; planks drop into place across the chasm, towers rise and cables draw, then cards start crossing and keep crossing.',
  use: 'Integration, partnership and access: connecting two systems or teams, "now they can reach it", closing a gap, a new channel. Hopeful and constructive; works on light and dark palettes. Replace LEFT and RIGHT (the two sides) with sketchText; land BUILD and CROSS on words with sketchSay.',
  build(w, h) {
    const L = layout(w, h),
      { top, gapL, gapR } = L;
    const span = gapR - gapL,
      n = L.planks,
      pw = span / n;
    const deck = `M ${gapL - 40} ${top} L ${gapR + 40} ${top}`;
    const towers = [gapL + span * 0.22, gapR - span * 0.22].map(round);
    const cable = `M ${gapL - 40} ${top - 4} Q ${towers[0]} ${top - L.towerH - 30} ${round((gapL + gapR) / 2)} ${top - L.towerH * 0.35} Q ${towers[1]} ${top - L.towerH - 30} ${gapR + 40} ${top - 4}`;
    const tile = ([x, y], size, icon, fill) => ({
      type: 'group', enter: 'pop', at: 0.2, dur: 0.35,
      children: [
        { type: 'rect', x: x - size / 2, y: y - size / 2, w: size, h: size, r: round(size * 0.2), fill, stroke: 'ink', width: 4 },
        { type: 'icon', name: icon, x, y, size: round(size * 0.5), fill: fill === 'accent' ? 'bg' : 'ink' },
      ],
    });
    return {
      elements: [
        // The chasm and the two cliffs.
        { type: 'rect', x: gapL, y: top, w: span, h: h - top, fill: { gradient: ['surface', 'bg'], angle: 90 }, enter: 'none', at: 0 },
        { type: 'poly', points: [[0, top], [gapL, top], [gapL - 30, top + 120], [gapL + 10, top + 260], [gapL - 50, h], [0, h]], closed: true, fill: 'surface', stroke: 'ink', width: 4, enter: 'none', at: 0 },
        { type: 'poly', points: [[w, top], [gapR, top], [gapR + 40, top + 140], [gapR - 10, top + 300], [gapR + 60, h], [w, h]], closed: true, fill: 'surface', stroke: 'ink', width: 4, enter: 'none', at: 0 },
        ...L.people.map(p => tile(p, L.tile, L.peopleIcon, 'surface')),
        tile(L.place, L.big, 'database', 'accent'),
        // The bridge goes up on BUILD: towers rise, planks drop in order, then the cables draw.
        ...towers.map(x => ({ type: 'rect', x: x - 10, y: top - L.towerH, w: 20, h: L.towerH + 30, r: 4, fill: 'ink', origin: [x, top], enter: 'grow-y', cue: 'BUILD', at: AT.BUILD, dur: 0.6 })),
        {
          type: 'group', enter: 'none', cue: 'BUILD', at: AT.BUILD, stagger: round(1.2 / n),
          children: Array.from({ length: n }, (_, i) => ({ type: 'rect', x: round(gapL + i * pw + 3), y: top - 8, w: round(pw - 6), h: 22, r: 3, fill: 'accent2', stroke: 'ink', width: 3, enter: 'drop', dur: 0.3 })),
        },
        { type: 'path', d: cable, fill: 'none', stroke: 'ink', width: 5, enter: 'draw', cue: 'BUILD', at: AT.BUILD, dur: 1.6 },
        // Cards cross on CROSS and keep crossing, each on its own loop so they spread out.
        ...[0, 1, 2].map(i => ({
          type: 'rect', x: gapL - 60, y: top - 52, w: 44, h: 36, r: 8, fill: i === 1 ? 'accent2' : 'accent', stroke: 'ink', width: 3, enter: 'pop', cue: 'CROSS', at: AT.CROSS, dur: 0.2,
          along: { d: `M ${gapL - 120} ${top - 34} L ${gapR + 120} ${top - 34}`, cue: 'CROSS', at: AT.CROSS, dur: round(2.2 + i * 0.55), ease: 'linear', loop: true },
        })),
        ...['LEFT', 'RIGHT'].map((text, i) => ({ type: 'text', text, x: L.labels[i][0], y: L.labels[i][1], size: L.size, font: 'semibold', fill: 'ink', anchor: 'middle', fit: L.fit, enter: 'fade', at: 0.5, dur: 0.5 })),
      ],
    };
  },
};
