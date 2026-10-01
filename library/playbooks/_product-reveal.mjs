// Generates product-reveal.json (run from the repository root: node library/playbooks/_product-reveal.mjs).
// The product is drawn, not a stock solid: a ring (Halo) on a black stage, lit from above, with
// its own light inside. A ring is a short cylinder seen at a tilt: the top rim is an ellipse,
// the near band hangs below it, and through the opening the far inner wall and the floor show.
import fs from 'node:fs';

const r = v => Math.round(v * 10) / 10;
const SAMPLE = 'Illustrative sample data · replace before publishing';

/** An ellipse as a path (sweep 1 is clockwise; 0 cuts a hole in a shape drawn the other way). */
const ell = (x, y, a, b, sweep = 1) =>
  `M ${r(x - a)} ${r(y)} A ${r(a)} ${r(b)} 0 1 ${sweep} ${r(x + a)} ${r(y)} A ${r(a)} ${r(b)} 0 1 ${sweep} ${r(x - a)} ${r(y)} Z`;

/**
 * The ring: `R` outer radius, `H` band height, `t` wall thickness, `tilt` degrees from edge-on.
 * Returns the parts in paint order plus the geometry the stage needs (the floor line).
 */
function ring({ cx, cy, R, H, t, tilt, glow = 1, shine = { at: 0.6, dur: 1.8 }, haloAt = null }) {
  const s = Math.sin((tilt * Math.PI) / 180),
    d = H * Math.cos((tilt * Math.PI) / 180),
    ry = R * s,
    top = cy - d / 2,
    ri = R - t,
    rri = ri * s;
  // The near band: the top rim's near arc, down the right side, back along the bottom rim.
  const bandAt = dy =>
    `M ${r(cx - R)} ${r(top + dy)} A ${r(R)} ${r(ry)} 0 0 0 ${r(cx + R)} ${r(top + dy)} L ${r(cx + R)} ${r(top + d + dy)} A ${r(R)} ${r(ry)} 0 0 1 ${r(cx - R)} ${r(top + d + dy)} Z`;
  const farArc = (y, a, b) => `M ${r(cx - a)} ${r(y)} A ${r(a)} ${r(b)} 0 0 1 ${r(cx + a)} ${r(y)}`;
  const nearArc = (y, a, b) => `M ${r(cx - a)} ${r(y)} A ${r(a)} ${r(b)} 0 0 0 ${r(cx + a)} ${r(y)}`;
  const floor = top + d + ry;
  const parts = [
    // On a black gloss floor: the band's reflection, fading away from the contact line.
    {
      type: 'path',
      d: bandAt(d + 2),
      fill: { gradient: ['muted', 'bg'], angle: 90 },
      stroke: 'none',
      opacity: 0.22,
    },
    // Contact shadow where the bottom rim meets the floor.
    {
      type: 'ellipse',
      cx,
      cy: r(top + d),
      rx: r(R * 1.02),
      ry: r(ry * 1.05),
      fill: 'bg',
      stroke: 'none',
      blur: r(R * 0.04),
      opacity: 0.9,
    },
    // The far inner wall, seen through the opening, and the halo light running around it.
    {
      type: 'path',
      d: ell(cx, top, ri, rri),
      fill: { gradient: ['bg', 'surface', 'muted'], angle: 90 },
      stroke: 'none',
    },
    {
      id: 'halo',
      type: 'path',
      d: farArc(top + d * 0.55, ri * 0.985, rri * 0.985),
      fill: 'none',
      stroke: 'accent',
      width: r(Math.max(2, H * 0.035)),
      cap: 'round',
      glow: { blur: r(H * 0.12), color: 'accent', opacity: glow },
      opacity: glow,
    },
    // Looking through the ring to the floor, which the halo lights blue.
    { type: 'path', d: ell(cx, top + d, ri, rri), fill: 'bg', stroke: 'none' },
    {
      type: 'ellipse',
      cx,
      cy: r(top + d),
      rx: r(ri * 0.9),
      ry: r(rri * 0.9),
      fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
      opacity: r(0.38 * glow),
    },
    // The near band: brushed metal, a key light from the upper left and a cooler fill.
    {
      type: 'path',
      d: bandAt(0),
      fill: { gradient: ['surface', 'ink', 'muted', 'bg'], angle: 0 },
      stroke: 'none',
      ...(shine ? { shine: { angle: 18, width: 0.22, opacity: 0.9, ...shine } } : {}),
    },
    // The lower edge turns away from the light; the chamfer on the top edge catches it.
    {
      type: 'path',
      d: nearArc(top + d, R, ry),
      fill: 'none',
      stroke: 'bg',
      width: r(Math.max(1.5, H * 0.03)),
      opacity: 0.8,
    },
    // The top rim, lit from above.
    {
      type: 'path',
      d: `${ell(cx, top, R, ry, 1)} ${ell(cx, top, ri, rri, 0)}`,
      fill: { gradient: ['muted', 'ink'], angle: 90 },
      stroke: 'none',
    },
    {
      type: 'path',
      d: nearArc(top, R * 0.997, ry * 0.997),
      fill: 'none',
      stroke: 'ink',
      width: r(Math.max(1.2, H * 0.014)),
      opacity: 0.95,
      glow: { blur: r(H * 0.05), opacity: 0.6 },
    },
  ];
  for (const p of parts) Object.assign(p, { at: 0, enter: 'none' }, p.id === 'halo' && haloAt != null ? { at: haloAt, enter: 'draw', dur: 1.4 } : {});
  return { parts, floor: r(floor), top: r(top), d: r(d), ry: r(ry), rri: r(rri), ri: r(ri) };
}

/** The black stage: a soft beam from above, dust turning in it, a pool of light on the floor. */
const stage = (cx, floorY, { beam = 0.07, at = 0 } = {}) => [
  {
    type: 'poly',
    points: [
      [cx - 70, -40],
      [cx + 70, -40],
      [cx + 470, floorY + 60],
      [cx - 470, floorY + 60],
    ],
    closed: true,
    fill: { gradient: ['ink', 'ink'], angle: 90, fade: true },
    opacity: beam,
    blur: 30,
    z: 1.5,
    at,
    enter: 'none',
  },
  {
    type: 'ellipse',
    cx,
    cy: floorY,
    rx: 620,
    ry: 90,
    fill: { gradient: ['muted', 'muted'], radial: true, fade: true },
    opacity: 0.28,
    at,
    enter: 'none',
  },
  {
    type: 'particles',
    x: cx - 380,
    y: 40,
    w: 760,
    h: floorY - 80,
    kind: 'dust',
    count: 36,
    seed: 4,
    size: 2.4,
    speed: 0.4,
    fill: 'ink',
    opacity: 0.45,
    z: -0.3,
    at,
    enter: 'none',
  },
];

const HERO = { cx: 960, cy: 430, R: 330, H: 128, t: 18, tilt: 24 };
const hero = ring(HERO);

const beats = [
  // Wide: the stage is lit before anything else; the ring arrives edge-on as a line of light
  // and turns toward us as the voice asks the question.
  {
    id: 'dark',
    block: 'canvas',
    // The first frame is the picture, not a fade up from black.
    transition: 'cut',
    vo: 'We started with a single question.',
    hold: 0.4,
    props: {
      view: [96, 54, 1728, 972],
      viewFrom: [0, 0, 1920, 1080],
      viewAt: 0,
      viewDur: 4.5,
      elements: [
        ...stage(960, hero.floor, { beam: 0.06 }),
        {
          type: 'group',
          at: 0.15,
          enter: 'fade',
          dur: 0.6,
          origin: [960, hero.floor - hero.d],
          keys: [
            { at: 0, scaleY: 0.05, dur: 0 },
            { at: 0.9, scaleY: 1, dur: 2.6, ease: 'inOut' },
          ],
          children: ring({ ...HERO, shine: { at: 1.6, dur: 1.8 }, haloAt: 2.2 }).parts,
        },
      ],
    },
  },
  // Macro: the camera glides along the near edge; the line sits in the black beside it.
  {
    id: 'part',
    block: 'canvas',
    vo: 'What if it simply got out of the way?',
    hold: 0.3,
    props: {
      view: [940, 280, 760, 427.5],
      viewFrom: [1060, 330, 640, 360],
      viewAt: 0,
      viewDur: 4,
      viewTall: [1000, 260, 330, 587],
      elements: [
        ...stage(960, hero.floor, { beam: 0.05 }),
        { type: 'group', at: 0, enter: 'none', children: ring({ ...HERO, shine: { at: 0.4, dur: 2.4 } }).parts },
        {
          type: 'text',
          text: 'Nothing extra.',
          x: 1360,
          y: 610,
          size: 21,
          font: 'light',
          fill: 'ink',
          anchor: 'start',
          at: 1.3,
          enter: 'blur',
          dur: 0.8,
        },
      ],
    },
  },
  // Insert: one number, its unit and what it is compared with, and the comparison drawn.
  {
    id: 'spec-1',
    block: 'canvas',
    vo: 'Twice as fast,',
    hold: 2.4,
    transition: 'cut',
    props: {
      source: SAMPLE,
      elements: [
        {
          type: 'ellipse',
          cx: 760,
          cy: 470,
          rx: 520,
          ry: 260,
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.1,
          at: 0,
          enter: 'none',
        },
        {
          type: 'text',
          text: '2×',
          x: 700,
          y: 610,
          size: 380,
          font: 'display',
          anchor: 'end',
          fill: { gradient: ['muted', 'ink', 'muted'], angle: 90 },
          at: 0,
          enter: 'blur',
          dur: 0.22,
          shine: { at: 0.5, dur: 1.2, angle: 20 },
          keys: [
            { at: 0, scale: 1.04, dur: 0 },
            { at: 0, scale: 1, dur: 1.8, ease: 'out' },
          ],
          origin: [520, 480],
        },
        {
          type: 'text',
          text: 'FASTER CHARGING',
          x: 770,
          y: 430,
          size: 64,
          font: 'bold',
          tracking: 0.06,
          fill: 'ink',
          at: 0.2,
          enter: 'rise',
          dur: 0.5,
        },
        {
          type: 'text',
          text: 'than the first generation',
          x: 770,
          y: 500,
          size: 44,
          font: 'light',
          fill: 'muted',
          at: 0.35,
          enter: 'rise',
          dur: 0.5,
        },
        // The comparison, drawn: the same charge, in half the time.
        {
          type: 'text',
          text: 'HALO',
          x: 770,
          y: 640,
          size: 34,
          font: 'semibold',
          tracking: 0.12,
          fill: 'ink',
          at: 0.4,
          enter: 'fade',
          dur: 0.3,
        },
        { type: 'rect', x: 1190, y: 620, w: 500, h: 14, r: 7, fill: 'surface', at: 0.4, enter: 'fade', dur: 0.3 },
        {
          type: 'rect',
          x: 1190,
          y: 620,
          w: 500,
          h: 14,
          r: 5,
          fill: 'accent',
          glow: { blur: 10, opacity: 0.8 },
          at: 0.5,
          enter: 'grow-x',
          dur: 0.9,
        },
        {
          type: 'text',
          text: 'FIRST GENERATION',
          x: 770,
          y: 710,
          size: 34,
          font: 'semibold',
          tracking: 0.12,
          fill: 'muted',
          at: 0.4,
          enter: 'fade',
          dur: 0.3,
        },
        { type: 'rect', x: 1190, y: 694, w: 500, h: 14, r: 7, fill: 'surface', at: 0.4, enter: 'fade', dur: 0.3 },
        {
          type: 'rect',
          x: 1190,
          y: 694,
          w: 500,
          h: 14,
          r: 5,
          fill: 'muted',
          at: 0.5,
          enter: 'grow-x',
          dur: 1.8,
        },
      ],
    },
  },
  // Medium, from above: the halo stays lit while the sun crosses the day.
  (() => {
    const top = ring({ cx: 960, cy: 520, R: 210, H: 96, t: 14, tilt: 62, shine: { at: 0.3, dur: 2.6 } });
    const arc = 'M 560 600 A 400 400 0 0 1 1360 600';
    return {
      id: 'spec-2',
      block: 'canvas',
      vo: 'and it lasts all day.',
      hold: 1.2,
      transition: 'cut',
      props: {
        view: [0, 0, 1920, 1080],
        viewFrom: [60, 34, 1800, 1012.5],
        viewAt: 0,
        viewDur: 4,
        elements: [
          {
            type: 'ellipse',
            cx: 960,
            cy: 560,
            rx: 700,
            ry: 380,
            fill: { gradient: ['surface', 'surface'], radial: true, fade: true },
            opacity: 0.8,
            at: 0,
            enter: 'none',
          },
          {
            type: 'path',
            d: arc,
            fill: 'none',
            stroke: 'line',
            width: 3,
            dash: [2, 14],
            cap: 'round',
            at: 0,
            enter: 'none',
          },
          {
            type: 'path',
            d: arc,
            fill: 'none',
            stroke: 'accent',
            width: 4,
            cap: 'round',
            glow: { blur: 8, opacity: 0.7 },
            at: 0.3,
            enter: 'draw',
            dur: 2.4,
          },
          {
            type: 'icon',
            name: 'sun',
            x: 0,
            y: 0,
            size: 64,
            stroke: 'ink',
            at: 0.3,
            enter: 'fade',
            dur: 0.3,
            along: { d: arc, at: 0.3, dur: 2.4, ease: 'inOut' },
          },
          {
            type: 'icon',
            name: 'moon',
            x: 1360,
            y: 668,
            size: 52,
            stroke: 'muted',
            at: 2.4,
            enter: 'pop',
            dur: 0.4,
          },
          { type: 'group', at: 0, enter: 'none', children: top.parts },
          {
            type: 'text',
            text: 'ALL DAY.',
            x: 960,
            y: 900,
            size: 96,
            font: 'display',
            tracking: 0.2,
            anchor: 'middle',
            fill: 'ink',
            at: 0.6,
            enter: 'blur',
            dur: 0.6,
          },
        ],
      },
    };
  })(),
  // Wide: the whole object and its name. The camera pulls back from the halo.
  {
    id: 'whole',
    block: 'canvas',
    vo: 'Meet Halo.',
    hold: 1.4,
    transition: 'fade',
    props: {
      world: 'reveal',
      view: [0, 0, 1920, 1080],
      viewFrom: [560, 200, 800, 450],
      viewAt: 0,
      viewDur: 1.8,
      elements: [
        ...stage(960, hero.floor, { beam: 0.08 }),
        { type: 'group', at: 0, enter: 'none', children: ring({ ...HERO, shine: { at: 1.2, dur: 1.8 } }).parts },
        {
          type: 'text',
          text: 'HALO',
          x: 960,
          y: 900,
          size: 170,
          font: 'display',
          anchor: 'middle',
          tracking: 0.32,
          fill: { gradient: ['muted', 'ink', 'muted'], angle: 90 },
          enter: 'blur',
          at: 1.3,
          dur: 0.8,
          shine: { at: 1.9, dur: 1.4, angle: 22 },
        },
      ],
    },
  },
  // The button: the same shot settles; one line of availability.
  {
    id: 'button',
    block: 'canvas',
    vo: 'Available today.',
    hold: 0.8,
    props: {
      world: 'reveal',
      view: [-96, -40, 2112, 1188],
      viewDur: 3,
      viewAt: 0,
      elements: [
        {
          type: 'text',
          text: 'Available today.',
          x: 960,
          y: 1010,
          size: 60,
          font: 'light',
          anchor: 'middle',
          fill: 'ink',
          at: 0.2,
          enter: 'rise',
          dur: 0.6,
        },
      ],
    },
  },
];

const book = {
  order: 31,
  title: 'A product reveal: darkness, a part in close-up, specs as inserts, then the whole object',
  audience: 'Customers and press at a launch',
  inputs: 'The product (a drawing like the ring here, or a render), two sourced specs, the name, availability',
  theme: 'stage',
  transition: 'cut',
  sfx: 'subtle',
  textMotion: 'lines',
  texture: { grain: 0.12, vignette: 0.55 },
  lens: { grade: 'cool', gradeAmount: 0.3, bloom: 0.45, blur: 0.5 },
  note: 'Light the object; never decorate around it. The ring is drawn from a few ellipses (library/playbooks/_product-reveal.mjs): redraw your own product the same way, or place a render as an image element on the stage. Replace both specs with real figures and their sources; every number keeps its unit and what it is compared with.',
  beats,
};
fs.writeFileSync('library/playbooks/product-reveal.json', JSON.stringify(book, null, 2) + '\n');
