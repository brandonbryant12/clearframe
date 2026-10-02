// Type voices: which display family sets a film's titles, statements, chapters, endcards
// and kinetic text, and how emphasis is drawn. A voice is a JSON file in library/types
// (see library/README.md); the storyboard's `type` names one, usually from a treatment.
// The renderer receives the resolved voice in the job, so a project renders without the
// library that defined it. Body copy, labels, sources, captions and counters stay in Inter.
// This module has no imports: library.mjs validates voices with it as they load, and
// exports `types()` / `typeById()` for listings.

/** Bundled display face sets: the files each role resolves to (null: no such face). */
export const FACE_SETS = {
  inter: {
    family: 'Inter Display',
    bold: 'InterDisplay-Bold.ttf',
    regular: 'InterDisplay-SemiBold.ttf',
    light: 'InterDisplay-Light.ttf',
    italic: null,
  },
  playfair: {
    family: 'Playfair Display',
    bold: 'PlayfairDisplay-Bold.ttf',
    regular: 'PlayfairDisplay-Bold.ttf',
    light: null,
    italic: 'PlayfairDisplay-BoldItalic.ttf',
  },
  'archivo-wide': {
    family: 'Archivo Expanded',
    bold: 'ArchivoExpanded-ExtraBold.ttf',
    regular: 'ArchivoExpanded-ExtraBold.ttf',
    light: null,
    italic: null,
  },
  'space-grotesk': {
    family: 'Space Grotesk',
    bold: 'SpaceGrotesk-Bold.ttf',
    regular: 'SpaceGrotesk-Bold.ttf',
    light: 'SpaceGrotesk-Light.ttf',
    italic: null,
  },
  'big-shoulders': {
    family: 'Big Shoulders Display',
    bold: 'BigShouldersDisplay-ExtraBold.ttf',
    regular: 'BigShouldersDisplay-ExtraBold.ttf',
    light: null,
    italic: null,
  },
  bebas: {
    family: 'Bebas Neue',
    bold: 'BebasNeue-Regular.ttf',
    regular: 'BebasNeue-Regular.ttf',
    light: null,
    italic: null,
  },
  'dm-serif': {
    family: 'DM Serif Display',
    bold: 'DMSerifDisplay-Regular.ttf',
    regular: 'DMSerifDisplay-Regular.ttf',
    light: null,
    italic: 'DMSerifDisplay-Italic.ttf',
  },
  'instrument-serif': {
    family: 'Instrument Serif',
    bold: 'InstrumentSerif-Regular.ttf',
    regular: 'InstrumentSerif-Regular.ttf',
    light: null,
    italic: 'InstrumentSerif-Italic.ttf',
  },
  'plex-mono': {
    family: 'IBM Plex Mono',
    bold: 'IBMPlexMono-Medium.ttf',
    regular: 'IBMPlexMono-Medium.ttf',
    light: null,
    italic: null,
  },
  architects: {
    family: 'Architects Daughter',
    bold: 'ArchitectsDaughter-Regular.ttf',
    regular: 'ArchitectsDaughter-Regular.ttf',
    light: null,
    italic: null,
  },
};

/**
 * How emphasis phrases are drawn:
 * accent: the accent colour; serif: italic Instrument Serif in the accent (the editorial feeling word);
 * italic: the voice's own italic in the accent; weight: a light headline with the phrase in bold;
 * marker: an accent block behind the phrase; underline: an accent rule under it.
 */
export const EMPHASES = ['accent', 'serif', 'italic', 'weight', 'marker', 'underline'];
export const CASES = ['mixed', 'upper'];
export const DEFAULT_TYPE = 'inter';
/** The resolved default voice, for a beat that opts back out of a film's voice. */
export const DEFAULT_VOICE = { id: 'inter', display: 'inter', emphasis: 'accent', upper: false, tracking: -0.015, leading: 1 };

/** Validate one voice file (library.mjs calls this as items load). */
export function validateType(item, where) {
  if (!item.title || !item.when) throw new Error(`${where}: needs title and when`);
  const faces = FACE_SETS[item.display];
  if (!faces) throw new Error(`${where}: display must be one of ${Object.keys(FACE_SETS).join(', ')}`);
  const emphasis = item.emphasis ?? 'accent';
  if (!EMPHASES.includes(emphasis)) throw new Error(`${where}: emphasis must be ${EMPHASES.join(', ')}`);
  if (emphasis === 'italic' && !faces.italic)
    throw new Error(`${where}: ${item.display} has no italic; use weight, marker, underline, serif or accent`);
  if (emphasis === 'weight' && !faces.light)
    throw new Error(`${where}: ${item.display} has no light weight; use italic, marker, underline, serif or accent`);
  if (item.case != null && !CASES.includes(item.case)) throw new Error(`${where}: case must be mixed or upper`);
  if (item.tracking != null && !(typeof item.tracking === 'number' && item.tracking >= -0.1 && item.tracking <= 0.3))
    throw new Error(`${where}: tracking is letter-spacing in em, from -0.1 to 0.3`);
  if (item.leading != null && !(typeof item.leading === 'number' && item.leading >= 0.8 && item.leading <= 1.3))
    throw new Error(`${where}: leading multiplies the block's line height, from 0.8 to 1.3`);
}

/** The job's resolved voice for a storyboard `type` (an id) and its library item, or null for the default look. */
export function voiceOf(id, t) {
  if (id == null || id === DEFAULT_TYPE) return null;
  if (typeof id !== 'string') throw new Error('type must name a voice from library/types (clearframe types)');
  if (!t) throw new Error(`Unknown type "${id}". Run clearframe types.`);
  return {
    id,
    display: t.display,
    emphasis: t.emphasis ?? 'accent',
    upper: t.case === 'upper',
    tracking: t.tracking ?? -0.015,
    leading: t.leading ?? 1,
  };
}

/** The glyph-check face key (glyphs.mjs FACE) that a voice sets display text in, or null for Inter. */
export function voiceFace(voice, role = 'bold') {
  if (!voice) return null;
  const file = FACE_SETS[voice.display][role] ?? FACE_SETS[voice.display].bold;
  return file === FACE_SETS.inter.bold || file === FACE_SETS.inter.regular ? null : file;
}
