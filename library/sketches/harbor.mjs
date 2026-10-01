import { round, rng, smoothPath } from '../../fframes/sketch-kit.mjs';

// A harbor before dawn: container cranes on the quay with their warning lights, a lighthouse on
// the breakwater sweeping its beam through the haze, the far shore asleep across the water with a
// handful of windows lit, and one building on the near quay still awake. The water carries every
// light as a shimmering streak. `harbor(w, h, {dawn: true})` draws the same place at first light.
export function harbor(w, h, { seed, dawn = false } = {}) {
  const rand = rng(seed ?? 37),
    tallFrame = h > w,
    // Landscape coordinates scaled into the frame (a tall frame shows the middle of the harbor).
    s = tallFrame ? h / 1080 : w / 1920,
    ox = tallFrame ? (w - 1920 * s) / 2 + 360 * s : 0,
    X = v => round(ox + v * s),
    Y = v => round(v * s + (tallFrame ? (h - 1080 * s) / 2 : 0)),
    S = v => round(v * s),
    horizon = 600,
    quay = 760;
  const dots = (pts, r) => pts.map(([x, y]) => `M${X(x)} ${Y(y)}h.1`).join('');
  // The far shore: low blocks across the bay, a few windows awake.
  const shore = [],
    farWin = [];
  for (let x = -260; x < 2200; ) {
    const bw = 18 + rand() * 46,
      bh = 8 + rand() ** 2 * 64;
    shore.push(`M ${X(x)} ${Y(horizon)} V ${Y(horizon - bh)} H ${X(x + bw)} V ${Y(horizon)} Z`);
    if (!dawn && bh > 20) for (let k = 0; k < 3; k++) if (rand() > 0.6) farWin.push([x + 4 + rand() * (bw - 8), horizon - 4 - rand() * (bh - 8)]);
    x += bw + rand() * 10;
  }
  // A container crane: legs on the quay, a machinery house, a boom over the water, tie rods.
  const crane = (x, base, height, boom, raised) => {
    const top = base - height,
      lw = height * 0.32,
      by = top + height * 0.28;
    const tip = raised ? [x + boom * 0.45, top - boom * 0.85] : [x + boom, by];
    let d = `M ${X(x - lw / 2)} ${Y(base)} L ${X(x - lw * 0.18)} ${Y(by)} M ${X(x + lw / 2)} ${Y(base)} L ${X(x + lw * 0.18)} ${Y(by)}`;
    d += ` M ${X(x - lw / 2)} ${Y(base - height * 0.32)} L ${X(x + lw / 2)} ${Y(base - height * 0.32)}`;
    d += ` M ${X(x - lw * 0.4)} ${Y(by)} L ${X(tip[0])} ${Y(tip[1])}`;
    d += ` M ${X(x)} ${Y(top)} L ${X(tip[0] - (tip[0] - x) * 0.45)} ${Y(tip[1] + (by - tip[1]) * 0.45)} M ${X(x)} ${Y(top)} L ${X(tip[0])} ${Y(tip[1])}`;
    d += ` M ${X(x)} ${Y(top)} L ${X(x - lw * 0.7)} ${Y(by)} M ${X(x)} ${Y(top)} L ${X(x)} ${Y(by)}`;
    return {
      parts: [
        { type: 'path', d, fill: 'none', stroke: 'bg', width: S(6), join: 'round', cap: 'round' },
        { type: 'rect', x: X(x - lw * 0.22), y: Y(by - height * 0.07), w: S(lw * 0.44), h: S(height * 0.08), fill: 'bg' },
      ],
      light: [x, top],
    };
  };
  const cranes = [
    crane(250, quay, 330, 330, false),
    crane(570, quay, 400, 380, false),
    crane(880, quay, 300, 300, false),
  ];
  // Container stacks: solid steel boxes in the colours of a working port, one to three high, each
  // with its corrugation and a top edge caught by the lamps (night) or the low sun (dawn).
  const containers = [],
    ribs = [];
  const steel = ['accent', 'positive', 'muted', 'negative', 'accent2'];
  for (let x = 70; x < 1060; ) {
    const long = rand() > 0.35,
      cw = long ? 46 : 23,
      tiers = 1 + Math.floor(rand() * 3);
    for (let t = 0; t < tiers; t++) {
      const y = quay - 21 * (t + 1),
        colour = steel[Math.floor(rand() * steel.length)];
      containers.push(
        {
          type: 'rect',
          x: X(x),
          y: Y(y),
          w: S(cw - 1.5),
          h: S(20),
          fill: { gradient: [colour, dawn ? 'surface' : 'bg'], angle: 90 },
          opacity: dawn ? 0.75 : 0.62,
        },
        { type: 'rect', x: X(x), y: Y(y), w: S(cw - 1.5), h: S(1.6), fill: dawn ? 'accent2' : 'accent2', opacity: dawn ? 0.8 : 0.45 },
      );
      for (let k = 3; k < cw - 3; k += 3.2) ribs.push(`M${X(x + k)} ${Y(y + 2.5)}v${S(16)}`);
    }
    x += cw + (rand() > 0.8 ? 18 : 1.5);
  }
  containers.push({ type: 'path', d: ribs.join(''), fill: 'none', stroke: 'bg', width: S(0.9), opacity: 0.45 });
  // Quay lamps: sodium points along the edge, each with its pool of light.
  const lamps = [130, 420, 700, 990, 1260].map(x => [x, quay - 70]);
  // The lighthouse at the end of the breakwater.
  const lh = [1430, 640],
    lantern = [lh[0], lh[1] - 150];
  // The one building awake: the dispatch centre on the near quay, right of frame.
  const office = { x: 1590, y: 390, w: 420, h: quay - 390 + 40 };
  const offWin = [],
    floors = Math.floor((office.h - 70) / 52);
  for (let r = 0; r < floors; r++)
    for (let c = 0; c < 7; c++) {
      const lit = !dawn && ((r === 2 && c > 1 && c < 6) || (r === 3 && c > 2 && c < 5) || rand() > 0.9);
      offWin.push({
        type: 'rect',
        x: X(office.x + 26 + c * 56),
        y: Y(office.y + 34 + r * 52),
        w: S(34),
        h: S(30),
        fill: lit ? 'accent2' : 'surface',
        opacity: lit ? 0.95 : dawn ? 0.5 : 0.35,
      });
    }
  // Floor slabs between the window rows, and the plant on the roof.
  const slabs = Array.from({ length: floors + 1 }, (_, r) => `M${X(office.x)} ${Y(office.y + 24 + r * 52)}h${S(office.w)}`).join('');
  // Every light is carried on the water as a broken streak below its own waterline, at its depth.
  const reflections = [];
  const reflect = (x, y, axis, len, color, width, opacity, z) =>
    reflections.push({
      type: 'line',
      x1: X(x),
      y1: Y(2 * axis - y),
      x2: X(x),
      y2: Y(2 * axis - y + len),
      stroke: color,
      width: S(width),
      cap: 'round',
      opacity,
      dash: [S(8), S(6)],
      z,
      glow: { blur: S(5), opacity: 0.7 },
      loop: { type: 'dash', period: round(2 + rand() * 2) },
    });
  if (!dawn) {
    farWin.forEach(([x, y]) => rand() > 0.4 && reflect(x, y, horizon, 24 + rand() * 20, 'accent2', 2, 0.4, 4));
    lamps.forEach(([x, y]) => reflect(x, y, quay + 28, 56, 'accent2', 5, 0.55, 1));
    reflect(lantern[0], lantern[1], 636, 120, 'ink', 4, 0.5, 1.5);
  }
  const sky = dawn ? ['bg', 'surface', 'accent', 'accent2'] : ['bg', 'bg', 'bg', 'surface'];
  const top = dawn ? -700 : -900;
  const sea = [];
  for (let i = 0; i < 9; i++) {
    const y = horizon + 10 + i ** 1.6 * 9;
    sea.push(`M ${X(-300)} ${Y(y)} L ${X(2300)} ${Y(y + (rand() - 0.5) * 4)}`);
  }
  const els = [
    {
      type: 'rect',
      x: X(-400),
      y: Y(top),
      w: S(2800),
      h: S(horizon - top),
      fill: { gradient: sky, angle: 90 },
      at: 0,
      enter: 'none',
    },
    ...(dawn
      ? [
          {
            type: 'ellipse',
            cx: X(1150),
            cy: Y(horizon),
            rx: S(900),
            ry: S(260),
            fill: { gradient: ['ink', 'accent2'], radial: true, fade: true },
            opacity: 0.55,
            z: 8,
            at: 0,
            enter: 'none',
          },
        ]
      : [
          {
            type: 'particles',
            x: X(-300),
            y: Y(top),
            w: S(2500),
            h: S(horizon - top - 200),
            kind: 'stars',
            count: 120,
            seed: 13,
            size: S(1.8),
            fill: 'ink',
            opacity: 0.5,
            z: 10,
            at: 0,
            enter: 'none',
          },
          {
            type: 'ellipse',
            cx: X(900),
            cy: Y(horizon),
            rx: S(1300),
            ry: S(170),
            fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
            opacity: 0.32,
            z: 8,
            at: 0,
            enter: 'none',
          },
          // The city's glow low on the water.
          {
            type: 'ellipse',
            cx: X(900),
            cy: Y(horizon + 30),
            rx: S(1200),
            ry: S(70),
            fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
            opacity: 0.16,
            at: 0,
            enter: 'none',
          },
        ]),
    // Long clouds: lit from below at dawn, dark against the glow at night.
    ...[-200, 60, 230, 380].map((y, i) => ({
      type: 'ellipse',
      cx: X(300 + i * 430),
      cy: Y(y),
      rx: S(640 - i * 70),
      ry: S(7 + i * 2),
      fill: dawn ? 'accent2' : 'muted',
      opacity: dawn ? 0.55 : 0.14,
      blur: S(6),
      z: 6,
      at: 0,
      enter: 'none',
      loop: { type: 'float', period: 18 + i * 4, amount: S(14) },
    })),
    { type: 'path', d: shore.join(' '), fill: dawn ? 'surface' : 'bg', stroke: 'none', opacity: dawn ? 0.9 : 1, z: 4, at: 0, enter: 'none' },
    ...(farWin.length
      ? [
          {
            type: 'path',
            d: dots(farWin),
            fill: 'none',
            stroke: 'accent2',
            width: S(3),
            cap: 'round',
            glow: { blur: S(4), opacity: 0.8 },
            z: 4,
            at: 0,
            enter: 'none',
          },
        ]
      : []),
    // Water: the sky's light near the horizon, darkening toward us.
    {
      type: 'rect',
      x: X(-400),
      y: Y(horizon),
      w: S(2800),
      h: S(1200),
      fill: { gradient: dawn ? ['accent', 'surface', 'bg'] : ['surface', 'bg', 'bg'], angle: 90 },
      opacity: dawn ? 1 : 0.85,
      at: 0,
      enter: 'none',
    },
    {
      type: 'path',
      d: sea.join(' '),
      fill: 'none',
      stroke: dawn ? 'accent2' : 'muted',
      width: S(1.5),
      opacity: dawn ? 0.3 : 0.2,
      at: 0,
      enter: 'none',
      loop: { type: 'float', period: 7, amount: S(3) },
    },
    ...reflections.map(el => ({ ...el, at: 0, enter: 'none' })),
    // The breakwater and the lighthouse.
    {
      type: 'path',
      d: `M ${X(1300)} ${Y(648)} L ${X(1360)} ${Y(632)} L ${X(2300)} ${Y(632)} L ${X(2300)} ${Y(656)} Z`,
      fill: 'bg',
      stroke: 'none',
      z: 1.5,
      at: 0,
      enter: 'none',
    },
    {
      type: 'path',
      d: `M ${X(lh[0] - 18)} ${Y(lh[1] - 4)} L ${X(lh[0] - 11)} ${Y(lantern[1] + 14)} L ${X(lh[0] + 11)} ${Y(lantern[1] + 14)} L ${X(lh[0] + 18)} ${Y(lh[1] - 4)} Z M ${X(lh[0] - 14)} ${Y(lantern[1] + 14)} H ${X(lh[0] + 14)} V ${Y(lantern[1] + 10)} H ${X(lh[0] - 14)} Z M ${X(lh[0] - 9)} ${Y(lantern[1] - 10)} L ${X(lh[0])} ${Y(lantern[1] - 22)} L ${X(lh[0] + 9)} ${Y(lantern[1] - 10)} Z`,
      fill: 'bg',
      stroke: 'none',
      z: 1.5,
      at: 0,
      enter: 'none',
    },
    ...(dawn
      ? []
      : [
          {
            type: 'poly',
            points: [
              [X(lantern[0]), Y(lantern[1] - 3)],
              [X(lantern[0] - 1300), Y(lantern[1] - 190)],
              [X(lantern[0] - 1300), Y(lantern[1] + 150)],
              [X(lantern[0]), Y(lantern[1] + 3)],
            ],
            closed: true,
            fill: { gradient: ['ink', 'ink'], angle: 180, fade: true },
            opacity: 0.16,
            blur: S(14),
            blend: 'screen',
            origin: [X(lantern[0]), Y(lantern[1])],
            z: 1.5,
            at: 0,
            enter: 'none',
            loop: { type: 'sway', period: 9, amount: 18 },
          },
        ]),
    {
      type: 'circle',
      cx: X(lantern[0]),
      cy: Y(lantern[1]),
      r: S(6),
      fill: dawn ? 'surface' : 'ink',
      glow: dawn ? undefined : { blur: S(18), color: 'accent2', opacity: 1 },
      z: 1.5,
      at: 0,
      enter: 'none',
    },
    // The quay: containers, cranes, lamps.
    ...containers.map(c => ({ ...c, z: 1, at: 0, enter: 'none' })),
    { type: 'rect', x: X(-400), y: Y(quay), w: S(2000), h: S(30), fill: 'bg', z: 1, at: 0, enter: 'none' },
    ...cranes.flatMap(c => c.parts.map(p => ({ ...p, z: 1, at: 0, enter: 'none' }))),
    ...(dawn
      ? []
      : cranes.map((c, i) => ({
          type: 'circle',
          cx: X(c.light[0]),
          cy: Y(c.light[1] - 6),
          r: S(4.5),
          fill: 'negative',
          glow: { blur: S(10), opacity: 1 },
          z: 1,
          at: 0,
          enter: 'none',
          loop: { type: 'blink', period: round(1.8 + i * 0.5), amount: 0.9 },
        }))),
    ...lamps.flatMap(([x, y]) => [
      { type: 'line', x1: X(x), y1: Y(y), x2: X(x), y2: Y(quay), stroke: 'bg', width: S(4), z: 1, at: 0, enter: 'none' },
      ...(dawn
        ? []
        : [
            {
              type: 'ellipse',
              cx: X(x),
              cy: Y(quay - 4),
              rx: S(70),
              ry: S(14),
              fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
              opacity: 0.4,
              z: 1,
              at: 0,
              enter: 'none',
            },
            {
              type: 'circle',
              cx: X(x),
              cy: Y(y),
              r: S(5),
              fill: 'accent2',
              glow: { blur: S(16), opacity: 1 },
              z: 1,
              at: 0,
              enter: 'none',
            },
          ]),
    ]),
    // The dispatch centre: the building still awake.
    {
      type: 'group',
      z: 0.6,
      at: 0,
      enter: 'none',
      children: [
        { type: 'rect', x: X(office.x), y: Y(office.y), w: S(office.w), h: S(office.h), fill: 'bg' },
        { type: 'rect', x: X(office.x), y: Y(office.y), w: S(5), h: S(office.h), fill: dawn ? 'accent' : 'muted', opacity: 0.35 },
        { type: 'group', glow: dawn ? undefined : { blur: S(8), opacity: 0.6 }, children: offWin },
        { type: 'path', d: slabs, fill: 'none', stroke: dawn ? 'accent' : 'muted', width: S(2), opacity: 0.18 },
        { type: 'rect', x: X(office.x + 80), y: Y(office.y - 60), w: S(4), h: S(60), fill: 'bg' },
        { type: 'rect', x: X(office.x + 150), y: Y(office.y - 26), w: S(90), h: S(26), fill: 'bg' },
        { type: 'rect', x: X(office.x + 260), y: Y(office.y - 16), w: S(50), h: S(16), fill: 'bg' },
      ],
    },
    // Near the lens: the quay edge, a bollard and its rope, soft.
    {
      type: 'group',
      z: -0.35,
      at: 0,
      enter: 'none',
      blur: S(5),
      children: [
        { type: 'rect', x: X(-400), y: Y(985), w: S(2800), h: S(300), fill: 'bg' },
        { type: 'path', d: `M ${X(120)} ${Y(990)} L ${X(130)} ${Y(905)} Q ${X(185)} ${Y(880)} ${X(240)} ${Y(905)} L ${X(250)} ${Y(990)} Z`, fill: 'bg', stroke: 'none' },
        { type: 'path', d: `M ${X(185)} ${Y(920)} C ${X(380)} ${Y(1000)} ${X(560)} ${Y(1010)} ${X(820)} ${Y(1100)}`, fill: 'none', stroke: 'bg', width: S(14), cap: 'round' },
      ],
    },
  ];
  // Drop undefined glows, and hold everything still from the first frame (children too: a
  // shape without an entrance would otherwise fade or draw in).
  const clean = list =>
    list.forEach(el => {
      if (el.glow === undefined) delete el.glow;
      el.at ??= 0;
      el.enter ??= 'none';
      if (el.children) clean(el.children);
    });
  clean(els);
  return els;
}

export default {
  name: 'harbor',
  order: 11.2,
  summary:
    'A harbor before dawn: container cranes and their warning lights, a lighthouse sweeping its beam, the far shore asleep, one building on the quay still awake.',
  use: 'A port city, night work, arrivals and departures, "the city was still asleep". A documentary establishing shot; truck slowly across it.',
  build(w, h, { seed } = {}) {
    return {
      view: [0, 0, w, h],
      viewFrom: [round(-w * 0.05), 0, w, h],
      viewDur: 9,
      elements: harbor(w, h, { seed }),
    };
  },
};
