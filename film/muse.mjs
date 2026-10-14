// A seeded creative brief. Models (and people) reach for the same choices every time; a muse
// draws a structural twist, a motif, a camera and cut signature, a palette, set pieces
// and a music feel from curated options, so every film starts somewhere different, and the
// seed makes any draw reproducible. Every option is one that works; variety never costs taste.
import { rng } from './sketch-kit.mjs';
import { items } from './library.mjs';

const TWISTS = [
  'Open on the ending, then rewind to how it got there.',
  'One continuous shot: a single world the camera never cuts away from.',
  'Tell it through one object that appears in every scene.',
  'A countdown: every beat is one step closer to the payoff.',
  'Two worlds side by side (before and after) that meet in the final shot.',
  'Travel through scales: from very large to very small, or the reverse.',
  'Ask a question in the first line that the last line answers in three words.',
  'Stop in the middle: a silent beat, then the film turns.',
  'The narrator speaks to one person; the viewer overhears.',
  'Every scene is lit by one source: a screen, a window, a flame.',
];
const MOTIFS = [
  'a circle that keeps returning in new sizes',
  'one line that draws itself through every scene',
  'light falling through a window',
  'a grid that fills, one cell at a time',
  'a colour that appears only at the turn',
  'rain, then its absence',
  'a door, closed and then open',
  'a path that is walked, then seen from above',
];
const CAMERAS = [
  { note: 'slow, constant push-ins' },
  { note: 'lateral tracking shots with parallax' },
  { note: 'a push to the detail that matters in each scene' },
  { note: 'locked-off frames with one sudden move' },
  { note: 'fly-throughs, dollying through depth' },
];
const CUTS = [
  { note: 'match cuts on shape (morph by id)', transition: 'cut' },
  { note: 'hard cuts on action', transition: 'cut' },
  { note: 'a push at each turn of the story', transition: 'cut', turn: 'push' },
  { note: 'fades into each key moment, cuts within a sequence', transition: 'fade' },
  { note: 'the camera travels through one world between chapters', transition: 'cut' },
];
const TYPE = ['lines', 'words', 'letters', 'cascade'];
const MUSIC = [
  'sparse piano and air',
  'a pulsing synth bass that builds',
  'low strings and a single bell',
  'tight, dry percussion',
  'an ambient drone with a slow heartbeat',
  'a solo cello, close and warm',
];
// Mechanism sketches in library/sketches: pictures of how something works, to build a scene on.
const SET_PIECES = [
  'route',
  'pipeline',
  'network',
  'balance',
  'versus',
  'split',
  'match',
  'vesting',
  'deadline',
  'untangle',
  'shortcut',
  'vault',
  'bridge',
  'maze',
  'portal',
  'seedling',
  'searchlight',
  'cut-paper',
  'device',
  'chat',
  'orbit',
  'signal',
];

const luminance = hex => {
  const c = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

/** A creative brief for `seed` (any integer). `dark` limits palettes to night grounds (film looks). */
export function muse(seed, { dark = true } = {}) {
  const rand = rng(Math.abs(Math.trunc(seed)) + 1);
  const pick = list => list[Math.floor(rand() * list.length)];
  const palettes = items('palettes').filter(p => !dark || luminance(p.colors.bg) < 0.1);
  const pieces = [...SET_PIECES];
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  pieces.length = 2;
  const camera = pick(CAMERAS),
    cut = pick(CUTS);
  return {
    seed,
    twist: pick(TWISTS),
    motif: pick(MOTIFS),
    camera: camera.note,
    cuts: cut.note,
    textMotion: pick(TYPE),
    palette: pick(palettes).id,
    setPieces: pieces,
    music: pick(MUSIC),
    apply: { transition: cut.transition, turn: cut.turn },
  };
}

/** The brief as markdown, for DIRECTION.md. */
export function museMarkdown(m) {
  return `## Creative seed ${m.seed}

A starting point drawn from curated options (\`clearframe muse --seed ${m.seed}\` reproduces it). Keep what serves the story; change what doesn't.

- **Twist:** ${m.twist}
- **Motif:** ${m.motif}
- **Camera:** ${m.camera}
- **Cuts:** ${m.cuts}
- **Type:** ${m.textMotion}
- **Look:** the \`${m.palette}\` palette
- **Set pieces to try:** ${m.setPieces.map(s => `\`${s}\``).join(', ')}
- **Music:** ${m.music}
`;
}
