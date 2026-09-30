import { round } from '../../fframes/sketch-kit.mjs';

// A cold open: darkness, dust drifting close to the lens, and one far light. Focus starts
// on the dust and racks to the light, while the camera creeps forward.
export default {
  name: 'void',
  order: 9,
  summary:
    'A cold open: dust close to the lens, one far light, focus racking from one to the other as the camera creeps in.',
  use: 'The first seconds of a trailer or documentary: before the title, before the context. Cue the rack focus to the word that names the subject.',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h * 0.5);
    return {
      dolly: [{ at: 0, z: 1.1, dur: 9, ease: 'linear' }],
      focus: { z: -0.4, aperture: 1.4, keys: [{ at: 2.4, z: 9, dur: 1.8 }] },
      elements: [
        // Something is on screen with the first word: the far light, then the field around it.
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'stars',
          count: 140,
          fill: 'muted',
          opacity: 0.45,
          size: 2,
          z: 9,
          at: 0,
          enter: 'fade',
          dur: 0.8,
        },
        {
          type: 'circle',
          cx,
          cy,
          r: round(Math.min(w, h) * 0.2),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.22,
          z: 9,
          at: 0.2,
          enter: 'fade',
          dur: 1.2,
          loop: { type: 'pulse', period: 5, amount: 0.08 },
        },
        {
          type: 'circle',
          cx,
          cy,
          r: 7,
          fill: 'ink',
          glow: { blur: 22, color: 'accent', opacity: 1 },
          z: 9,
          at: 0.05,
          enter: 'fade',
          dur: 0.6,
          loop: { type: 'pulse', period: 3.2, amount: 0.12 },
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 42,
          fill: 'ink',
          opacity: 0.6,
          size: 5,
          z: -0.45,
          at: 0,
          enter: 'fade',
          dur: 0.5,
        },
      ],
    };
  },
};
