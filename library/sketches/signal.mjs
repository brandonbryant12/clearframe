import { round } from '../../fframes/sketch-kit.mjs';

// A signal in the dark: a hairline of light across black, a point of light at its heart with an
// anamorphic streak, and a waveform that begins to tremble out of the flat line and grows, its
// earlier moments trailing behind it like an oscilloscope's afterglow. Dust drifts close to the
// lens, soft, until focus racks to the line.
export default {
  name: 'signal',
  order: 8,
  summary:
    'A signal in the dark: a hairline of light, a point of light with an anamorphic streak, a waveform trembling out of the flat line and growing.',
  use: 'The first seconds of a trailer or teaser ("it begins as a whisper"), a cold open about sound, radio, a heartbeat or a message. Cue the wave to the word that names it.',
  build(w, h) {
    const tallFrame = h > w,
      cx = round(w / 2),
      cy = round(h / 2),
      amp = tallFrame ? w * 0.16 : h * 0.13,
      span = w * 1.1;
    // The wave: a carrier under a soft envelope, loudest at the centre and silent at the edges.
    const wave = (cycles, phase) => {
      const pts = [];
      for (let i = 0; i <= 220; i++) {
        const t = i / 220,
          x = cx - span / 2 + span * t,
          env = Math.exp(-(((t - 0.5) / 0.17) ** 2)),
          y = cy - amp * env * Math.sin(t * cycles * Math.PI * 2 + phase) * (0.75 + 0.25 * Math.sin(t * 7 + phase));
        pts.push(`${round(x)} ${round(y)}`);
      }
      return `M ${pts.join(' L ')}`;
    };
    const grow = (at, top) => [
      { at: 0, scaleY: 0.02, dur: 0 },
      { at, scaleY: top, dur: 1.9, ease: 'inOut' },
    ];
    return {
      dolly: [{ at: 0, z: 0.35, dur: 8, ease: 'linear' }],
      focus: { z: -0.4, aperture: 1.2, keys: [{ at: 0.5, z: 0, dur: 1.2 }] },
      elements: [
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'stars',
          count: 70,
          seed: 3,
          fill: 'muted',
          opacity: 0.3,
          size: 1.6,
          z: 6,
          at: 0,
          enter: 'none',
        },
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round(w * 0.38),
          ry: round(amp * 1.6),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.18,
          z: 0,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 3.6, amount: 0.08 },
        },
        // The flat line is there on the first frame.
        {
          type: 'line',
          x1: round(cx - span / 2),
          y1: cy,
          x2: round(cx + span / 2),
          y2: cy,
          stroke: 'muted',
          width: 2,
          opacity: 0.7,
          z: 0,
          at: 0,
          enter: 'none',
        },
        // Two waves out of phase, the second fainter: a signal with body, not a sine.
        {
          type: 'path',
          d: wave(13, 0.6),
          fill: 'none',
          stroke: 'accent2',
          width: 2,
          opacity: 0.55,
          z: 0,
          origin: [cx, cy],
          at: 0,
          enter: 'none',
          keys: grow(0.45, 0.7),
          echo: { count: 3, lag: 0.12, fade: 0.6 },
        },
        {
          type: 'path',
          d: wave(9, 0),
          fill: 'none',
          stroke: 'accent',
          width: 3.5,
          cap: 'round',
          glow: { blur: 10, opacity: 0.9 },
          z: 0,
          origin: [cx, cy],
          at: 0,
          enter: 'none',
          keys: grow(0.25, 1),
          echo: { count: 4, lag: 0.1, fade: 0.55 },
        },
        // The point of light and its anamorphic streak.
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round(w * (tallFrame ? 0.6 : 0.42)),
          ry: 3,
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          opacity: 0.95,
          blend: 'screen',
          z: 0,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 2.4, amount: 0.1 },
        },
        {
          type: 'circle',
          cx,
          cy,
          r: 9,
          fill: 'ink',
          glow: { blur: 30, color: 'accent', opacity: 1 },
          z: 0,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 2.4, amount: 0.2 },
        },
        // Dust close to the lens: soft until the focus pulls past it.
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 34,
          seed: 12,
          fill: 'ink',
          opacity: 0.6,
          size: 6,
          speed: 0.5,
          z: -0.45,
          glow: { blur: 6, color: 'accent', opacity: 0.6 },
          at: 0,
          enter: 'none',
        },
      ],
    };
  },
};
