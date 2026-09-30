// Starting compositions for the canvas block. Each sketch is a function of the frame size, so
// the same idea lays out for landscape, vertical, square and portrait. They are drafts to
// adapt (labels, counts, colours, cues), not finished graphics. `clearframe sketch NAME`
// prints one; `clearframe gallery --sketches` renders them all.
const frames = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080], portrait: [1080, 1350] };
const tall = (w, h) => h > w * 1.1;
const round = v => Math.round(v * 10) / 10;

/** Body region below a title (y from ~330) and above the footer, in frame pixels. */
function body(w, h) {
  const top = tall(w, h) ? h * 0.11 + 330 : 330;
  return { x: tall(w, h) ? 86 : 120, y: top, w: w - (tall(w, h) ? 172 : 240), h: h - top - (tall(w, h) ? 240 : 150) };
}

/** A smooth curve through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(points) {
  const p = points.map(([x, y]) => [round(x), round(y)]);
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[Math.max(0, i - 1)], p[i], p[i + 1], p[Math.min(p.length - 1, i + 2)]];
    const c1 = [round(b[0] + (c[0] - a[0]) / 6), round(b[1] + (c[1] - a[1]) / 6)],
      c2 = [round(c[0] - (e[0] - b[0]) / 6), round(c[1] - (e[1] - b[1]) / 6)];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c[0]} ${c[1]}`;
  }
  return d;
}

export const SKETCHES = [
  {
    name: 'route',
    summary: 'A journey: the path draws through stops, each stop lands as the line reaches it, a marker travels.',
    use: 'Processes over time, customer journeys, travel, a story with milestones.',
    build(w, h) {
      const r = body(w, h),
        n = 4;
      const stops = tall(w, h)
        ? [
            [r.x + r.w * 0.2, r.y + r.h * 0.92],
            [r.x + r.w * 0.8, r.y + r.h * 0.64],
            [r.x + r.w * 0.22, r.y + r.h * 0.36],
            [r.x + r.w * 0.78, r.y + r.h * 0.08],
          ]
        : [
            [r.x + r.w * 0.06, r.y + r.h * 0.78],
            [r.x + r.w * 0.36, r.y + r.h * 0.3],
            [r.x + r.w * 0.64, r.y + r.h * 0.66],
            [r.x + r.w * 0.94, r.y + r.h * 0.16],
          ];
      const d = smoothPath(stops),
        draw = 2.4,
        labels = ['Start', 'First step', 'Setback', 'Arrive'];
      return {
        elements: [
          { type: 'path', d, stroke: 'line', width: 14, at: 0.2, dur: 0.01, enter: 'fade', opacity: 0.6 },
          { type: 'path', d, stroke: 'accent', width: 8, at: 0.3, dur: draw, arrow: 'end' },
          ...stops.flatMap(([x, y], i) => [
            {
              type: 'circle',
              cx: round(x),
              cy: round(y),
              r: 26,
              fill: i === n - 1 ? 'accent2' : 'accent',
              stroke: 'bg',
              width: 6,
              at: round(0.3 + (draw * i) / (n - 1)),
              ...(i === n - 1 ? { glow: { blur: 16 } } : {}),
            },
            // Vertical routes zigzag, so labels sit outside the curve; wide routes label below.
            tall(w, h)
              ? {
                  type: 'text',
                  text: labels[i],
                  x: round(x + (i % 2 ? 50 : -50)),
                  y: round(y + 13),
                  size: 38,
                  anchor: i % 2 ? 'start' : 'end',
                  font: 'semibold',
                  fill: 'ink',
                  at: round(0.4 + (draw * i) / (n - 1)),
                }
              : {
                  type: 'text',
                  text: labels[i],
                  x: round(x),
                  y: round(y + 78),
                  size: 38,
                  anchor: 'middle',
                  font: 'semibold',
                  fill: 'ink',
                  at: round(0.4 + (draw * i) / (n - 1)),
                },
          ]),
          {
            type: 'circle',
            cx: round(stops[0][0]),
            cy: round(stops[0][1]),
            r: 13,
            fill: 'bg',
            enter: 'fade',
            at: 0.3,
            along: { d, dur: draw, ease: 'inOut' },
          },
        ],
      };
    },
  },
  {
    name: 'orbit',
    summary: 'A system around a centre: rings draw, satellites circle at different speeds.',
    use: 'Ecosystems, stakeholders around a product, forces around a decision.',
    build(w, h) {
      const r = body(w, h),
        cx = round(r.x + r.w / 2),
        cy = round(r.y + r.h / 2),
        R = (Math.min(r.w, r.h) / 2) * 0.92;
      const rings = [0.45, 0.72, 1].map(k => round(R * k));
      return {
        elements: [
          ...rings.map((rad, i) => ({
            type: 'circle',
            cx,
            cy,
            r: rad,
            fill: 'none',
            stroke: 'line',
            width: 3,
            at: 0.2 + i * 0.15,
            dur: 1,
          })),
          {
            type: 'circle',
            cx,
            cy,
            r: round(R * 0.26),
            fill: 'accent',
            at: 0.3,
            glow: { blur: 22, opacity: 0.7 },
            loop: { type: 'pulse', period: 2.4, amount: 0.04 },
          },
          {
            type: 'text',
            text: 'Core',
            x: cx,
            y: round(cy + 16),
            size: 46,
            anchor: 'middle',
            font: 'bold',
            fill: 'bg',
            at: 0.5,
          },
          ...rings.flatMap((rad, i) =>
            [0, 1].map(j => ({
              type: 'circle',
              cx: round(cx + rad * Math.cos(j * Math.PI + i)),
              cy: round(cy + rad * Math.sin(j * Math.PI + i)),
              r: 18 - i * 3,
              fill: j ? 'accent2' : 'ink',
              origin: [cx, cy],
              at: round(0.9 + i * 0.2 + j * 0.1),
              loop: { type: 'spin', period: 7 + i * 4, amount: i % 2 ? -1 : 1 },
            })),
          ),
        ],
      };
    },
  },
  {
    name: 'pipeline',
    summary: 'Connected stages: cards pop in order, dashed connectors march between them.',
    use: 'How data or work flows; a handoff chain; cause and effect.',
    build(w, h) {
      const r = body(w, h),
        labels = ['Collect', 'Clean', 'Model', 'Ship'],
        n = labels.length,
        vert = tall(w, h);
      const cw = vert ? r.w * 0.7 : (r.w - 90 * (n - 1)) / n,
        ch = vert ? (r.h - 70 * (n - 1)) / n : 170;
      const pos = i =>
        vert ? [r.x + (r.w - cw) / 2, r.y + i * (ch + 70)] : [r.x + i * (cw + 90), r.y + (r.h - ch) / 2];
      const els = [];
      labels.forEach((label, i) => {
        const [x, y] = pos(i),
          at = round(0.3 + i * 0.5);
        els.push({
          type: 'group',
          at,
          children: [
            {
              type: 'rect',
              x: round(x),
              y: round(y),
              w: round(cw),
              h: round(ch),
              r: 28,
              fill: i === n - 1 ? 'accent' : 'surface',
              enter: 'pop',
            },
            {
              type: 'text',
              text: label,
              x: round(x + cw / 2),
              y: round(y + ch / 2 + 16),
              size: 44,
              anchor: 'middle',
              font: 'bold',
              fill: i === n - 1 ? 'bg' : 'ink',
              enter: 'fade',
            },
          ],
        });
        if (i < n - 1) {
          const [nx, ny] = pos(i + 1);
          const line = vert
            ? { x1: round(x + cw / 2), y1: round(y + ch + 10), x2: round(nx + cw / 2), y2: round(ny - 10) }
            : { x1: round(x + cw + 10), y1: round(y + ch / 2), x2: round(nx - 10), y2: round(ny + ch / 2) };
          els.push({
            type: 'line',
            ...line,
            stroke: 'accent',
            width: 6,
            dash: [14, 12],
            arrow: 'end',
            at: round(at + 0.3),
            dur: 0.4,
            enter: 'fade',
            loop: { type: 'dash', period: 0.8 },
          });
        }
      });
      return { elements: els };
    },
  },
  {
    name: 'network',
    summary: 'Nodes and links: edges draw, nodes pop, one node pulses as the hub.',
    use: 'Networks, communities, dependencies, spread of an idea.',
    build(w, h) {
      const r = body(w, h),
        pts = [
          [0.5, 0.5],
          [0.18, 0.25],
          [0.82, 0.2],
          [0.12, 0.78],
          [0.86, 0.74],
          [0.46, 0.1],
          [0.52, 0.92],
          [0.3, 0.52],
          [0.7, 0.5],
        ];
      const P = pts.map(([u, v]) => [round(r.x + u * r.w), round(r.y + v * r.h)]);
      const edges = [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 7],
        [0, 8],
        [1, 5],
        [2, 5],
        [3, 6],
        [4, 6],
        [7, 1],
        [8, 2],
        [7, 3],
        [8, 4],
      ];
      return {
        elements: [
          {
            type: 'group',
            at: 0.2,
            stagger: 0.08,
            children: edges.map(([a, b]) => ({
              type: 'line',
              x1: P[a][0],
              y1: P[a][1],
              x2: P[b][0],
              y2: P[b][1],
              stroke: 'line',
              width: 4,
              dur: 0.6,
            })),
          },
          {
            type: 'group',
            at: 0.8,
            stagger: 0.07,
            children: P.slice(1).map(([x, y]) => ({ type: 'circle', cx: x, cy: y, r: 22, fill: 'ink' })),
          },
          {
            type: 'circle',
            cx: P[0][0],
            cy: P[0][1],
            r: 90,
            fill: 'none',
            stroke: 'accent',
            width: 3,
            opacity: 0.6,
            at: 1.4,
            loop: { type: 'pulse', period: 1.6, amount: 0.15 },
          },
          {
            type: 'circle',
            cx: P[0][0],
            cy: P[0][1],
            r: 48,
            fill: 'accent',
            at: 1.3,
            glow: { blur: 18, opacity: 0.7 },
          },
        ],
      };
    },
  },
  {
    name: 'balance',
    summary: 'A metaphor that moves: a beam tips toward the heavier side on a spoken cue.',
    use: 'Trade-offs, risk versus reward, costs outweighing benefits.',
    build(w, h) {
      const r = body(w, h),
        cx = round(r.x + r.w / 2),
        base = round(r.y + r.h * (tall(w, h) ? 0.7 : 0.95)),
        span = Math.min(r.w * 0.8, 1100),
        top = round(base - Math.min(r.h * 0.55, 340));
      const pan = (x, label, color) => ({
        type: 'group',
        children: [
          { type: 'line', x1: x, y1: top, x2: x, y2: round(top + 120), stroke: 'muted', width: 4, enter: 'fade' },
          {
            type: 'path',
            d: `M ${round(x - 110)} ${round(top + 120)} Q ${x} ${round(top + 200)} ${round(x + 110)} ${round(top + 120)} Z`,
            fill: color,
            enter: 'fade',
          },
          {
            type: 'text',
            text: label,
            x,
            y: round(top + 250),
            size: 40,
            anchor: 'middle',
            font: 'semibold',
            fill: 'ink',
            enter: 'fade',
          },
        ],
      });
      const left = round(cx - span / 2),
        right = round(cx + span / 2);
      return {
        elements: [
          {
            type: 'poly',
            points: [
              [cx, top],
              [round(cx - 90), base],
              [round(cx + 90), base],
            ],
            closed: true,
            fill: 'surface',
            at: 0.2,
          },
          {
            type: 'group',
            at: 0.5,
            origin: [cx, top],
            keys: [{ at: 1.6, rotate: -9, dur: 0.9, ease: 'spring' }],
            children: [
              {
                type: 'rect',
                x: left,
                y: round(top - 8),
                w: round(span),
                h: 16,
                r: 8,
                fill: 'ink',
                enter: 'grow-x',
                origin: [cx, top],
              },
              pan(left, 'Cost', 'accent2'),
              pan(right, 'Benefit', 'accent'),
            ],
          },
          { type: 'circle', cx, cy: top, r: 14, fill: 'accent', at: 0.4 },
        ],
      };
    },
  },
  {
    name: 'versus',
    summary: 'Two sides split by a drawn divider, each with an icon and a word; a badge lands in the middle.',
    use: 'Before and after, myth and fact, two options, us and them.',
    build(w, h) {
      const r = body(w, h),
        vert = tall(w, h),
        mid = vert ? round(r.y + r.h / 2) : round(r.x + r.w / 2);
      const side = (i, icon, word, color) => {
        const [x, y] = vert
          ? [round(r.x + r.w / 2), round(r.y + r.h * (i ? 0.75 : 0.25))]
          : [round(r.x + r.w * (i ? 0.75 : 0.25)), round(r.y + r.h / 2)];
        return {
          type: 'group',
          at: round(0.5 + i * 0.6),
          children: [
            { type: 'icon', name: icon, x, y: round(y - 70), size: 120, stroke: color },
            {
              type: 'text',
              text: word,
              x,
              y: round(y + 90),
              size: 76,
              anchor: 'middle',
              font: 'bold',
              fill: 'ink',
              enter: 'rise',
            },
          ],
        };
      };
      return {
        elements: [
          vert
            ? { type: 'line', x1: r.x, y1: mid, x2: r.x + r.w, y2: mid, stroke: 'line', width: 4, at: 0.2, dur: 0.8 }
            : { type: 'line', x1: mid, y1: r.y, x2: mid, y2: r.y + r.h, stroke: 'line', width: 4, at: 0.2, dur: 0.8 },
          side(0, 'clock', 'Waiting', 'muted'),
          side(1, 'bolt', 'Moving', 'accent'),
          {
            type: 'group',
            at: 1.6,
            children: [
              {
                type: 'circle',
                cx: vert ? round(r.x + r.w / 2) : mid,
                cy: vert ? mid : round(r.y + r.h / 2),
                r: 54,
                fill: 'accent2',
                enter: 'pop',
              },
              {
                type: 'text',
                text: 'vs',
                x: vert ? round(r.x + r.w / 2) : mid,
                y: (vert ? mid : round(r.y + r.h / 2)) + 14,
                size: 40,
                anchor: 'middle',
                font: 'bold',
                fill: 'bg',
                enter: 'fade',
              },
            ],
          },
        ],
      };
    },
  },
  {
    name: 'burst',
    summary: 'One word lands big: it wipes on, an underline draws, short rays pop around it.',
    use: 'A key term, a verdict, a surprising word the narration stresses.',
    build(w, h) {
      const cx = round(w / 2),
        cy = round(h / 2),
        size = tall(w, h) ? 170 : 230,
        half = size * 1.55;
      // Rays sit on an ellipse clear of the word and skip the horizontal, where they would strike through it.
      const angles = [-70, -40, -12, 12, 40, 70, 110, 140, 168, 192, 220, 250].filter(
        d => Math.abs(Math.sin((d * Math.PI) / 180)) > 0.3,
      );
      const rays = angles.map((d, i) => {
        const a = (d * Math.PI) / 180,
          rx = half * 1.12,
          ry = size * 0.95;
        return {
          type: 'line',
          x1: round(cx + rx * Math.cos(a)),
          y1: round(cy + ry * Math.sin(a)),
          x2: round(cx + rx * 1.18 * Math.cos(a)),
          y2: round(cy + ry * 1.3 * Math.sin(a)),
          stroke: i % 2 ? 'accent2' : 'accent',
          width: 8,
          dur: 0.35,
        };
      });
      return {
        elements: [
          {
            type: 'text',
            text: 'Enough',
            x: cx,
            y: round(cy + size * 0.34),
            size,
            anchor: 'middle',
            font: 'bold',
            fill: 'ink',
            enter: 'wipe',
            at: 0.2,
            dur: 0.6,
          },
          {
            type: 'path',
            d: `M ${round(cx - half * 0.8)} ${round(cy + size * 0.55)} Q ${cx} ${round(cy + size * 0.75)} ${round(cx + half * 0.8)} ${round(cy + size * 0.5)}`,
            stroke: 'accent',
            width: 12,
            at: 0.7,
            dur: 0.6,
          },
          { type: 'group', at: 1.0, stagger: 0.04, children: rays, glow: { blur: 10, opacity: 0.6 } },
        ],
      };
    },
  },
  {
    name: 'ambient',
    summary: "Soft, slowly drifting shapes for a beat's art.under layer: depth without distraction.",
    use: 'Behind statements, quotes and kinetic type so a held frame never looks frozen.',
    build(w, h) {
      const blobs = [
        [0.15, 0.2, 0.22, 'accent'],
        [0.82, 0.3, 0.3, 'accent2'],
        [0.7, 0.85, 0.2, 'accent'],
        [0.3, 0.8, 0.16, 'accent2'],
        [0.5, 0.45, 0.12, 'ink'],
      ];
      return {
        layer: 'under',
        elements: [
          // A few specks of dust drift through: the held frame is never perfectly still.
          { type: 'particles', x: 0, y: 0, w, h, kind: 'dust', count: 36, fill: 'ink', opacity: 0.35, size: 3, at: 0 },
          ...blobs.map(([u, v, k, color], i) => ({
            type: 'circle',
            cx: round(u * w),
            cy: round(v * h),
            r: round(k * Math.max(w, h)),
            fill: { gradient: [color, color], radial: true, fade: true },
            opacity: 0.3,
            enter: 'fade',
            at: 0,
            dur: 1.2,
            loop: { type: i % 2 ? 'float' : 'orbit', period: 9 + i * 2.5, amount: 18 + i * 4 },
          })),
        ],
      };
    },
  },
  {
    name: 'niche',
    summary:
      'A mosaic niche: an arch of sky that turns from dusk to night, a moon laid in rings, a tiled sea, a sill and a beaded border.',
    use: 'Stories and places in the mosaic treatment: set a subject in the niche (a tower, a tree, a figure) and let the sky change with the story.',
    build(w, h) {
      const m = Math.min(w, h),
        cx = w / 2;
      const aw = m * 0.66,
        ax = cx - aw / 2,
        top = h * 0.5 - m * 0.44,
        sill = h * 0.5 + m * 0.4;
      const r = aw / 2,
        spring = top + r;
      const arch = `M ${round(ax)} ${round(sill)} L ${round(ax)} ${round(spring)} A ${round(r)} ${round(r)} 0 0 1 ${round(ax + aw)} ${round(spring)} L ${round(ax + aw)} ${round(sill)} Z`;
      const sea = sill - m * 0.18;
      return {
        elements: [
          {
            type: 'rect',
            x: round(cx - m * 0.46),
            y: round(h / 2 - m * 0.46),
            w: round(m * 0.92),
            h: round(m * 0.92),
            fill: 'none',
            stroke: 'accent',
            mosaic: { tile: 10 },
            enter: 'draw',
            at: 0,
            dur: 1.4,
          },
          {
            type: 'path',
            d: arch,
            fill: { gradient: ['#4a6fd0', '#f2c27a', '#e98a5a'] },
            stroke: 'ink',
            mosaic: {
              tile: 16,
              flow: 'contour',
              axis: 90,
              glint: 0.12,
              recolor: [{ at: 2.2, dur: 2, axis: 90, fill: { gradient: ['#101a78', '#2233a8'] } }],
            },
            enter: 'assemble',
            at: 0.2,
            dur: 1.8,
          },
          {
            type: 'rect',
            x: round(ax),
            y: round(sea),
            w: round(aw),
            h: round(sill - sea),
            fill: { gradient: ['#3cc0b4', '#1c5a8c'] },
            mosaic: { tile: 14, axis: 90, outline: false, glint: 0.6 },
            enter: 'assemble',
            at: 0.8,
            dur: 1.4,
          },
          {
            type: 'rect',
            x: round(ax - m * 0.02),
            y: round(sill),
            w: round(aw + m * 0.04),
            h: round(m * 0.04),
            fill: { gradient: ['#cfd3dc', '#6b7280'] },
            mosaic: { tile: 12, axis: 90, outline: false },
            enter: 'assemble',
            at: 0.3,
            dur: 1,
          },
          {
            type: 'circle',
            cx: round(ax + aw * 0.28),
            cy: round(top + r * 0.62),
            r: round(m * 0.07),
            fill: 'accent',
            mosaic: { tile: 11, flow: 'rings', glint: 0.4, build: 'fly', from: [round(cx), round(sea)], spread: 160 },
            enter: 'assemble',
            at: 2.2,
            dur: 1.4,
            glow: { blur: 22, opacity: 0.7 },
          },
        ],
      };
    },
  },
];
export const sketchByName = name => SKETCHES.find(s => s.name === name);

/** Canvas props (or an `art` layer for ambient sketches) for a frame preset. */
export function sketch(name, preset = 'landscape') {
  const s = sketchByName(name);
  if (!s) throw new Error(`Unknown sketch ${name}. Run clearframe sketch to list them.`);
  const [w, h] = frames[preset] ?? frames.landscape;
  return s.build(w, h);
}
export const SKETCH_FRAMES = frames;
