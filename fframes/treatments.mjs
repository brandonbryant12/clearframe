// Treatments: coherent art direction in one word. A treatment sets the film-level look
// (palette, backdrop, texture, frame, motion, transitions, voice, sound) and beat defaults
// (serif emphasis, rough strokes, kinetic mode), plus short rules for the author. They are
// starting directions to adapt, like playbooks are starting arcs.
export const TREATMENTS = [
  {
    id: 'editorial',
    title: 'Editorial data film',
    when: 'Reports, research digests, analysis with a few strong numbers',
    film: {
      theme: 'paper',
      backdrop: 'none',
      texture: { grain: 0.3 },
      motion: { preset: 'gentle', intensity: 0.65 },
      transition: 'fade',
      frame: { brand: 'Brief', left: 'Sources on screen', right: '' },
      sfx: 'subtle',
      voice: { style: 'clear, warm, quietly confident', takes: 'chapter' },
    },
    beats: { emphasisStyle: 'serif', graphic: 'panel' },
    rules: [
      'One claim per beat; the number lands on the stressed word.',
      'Serif italic for the single feeling word in a headline; mono for dates and units.',
      'A panel transition only at chapter turns; fades elsewhere.',
      'Colour-block (tone: accent) the one figure the film is about.',
    ],
  },
  {
    id: 'noir',
    title: 'Noir documentary',
    when: 'True stories, investigations, history, premium reveals',
    film: {
      theme: 'noir',
      backdrop: 'glow',
      texture: { grain: 0.55, vignette: 0.7 },
      motion: { preset: 'gentle', intensity: 0.55 },
      transition: 'fade',
      sfx: 'subtle',
      voice: { style: 'low, measured, intimate', takes: 'chapter' },
    },
    beats: { emphasisStyle: 'serif', graphic: 'iris' },
    rules: [
      'Plates with duotone treatment carry place and people; drift slowly.',
      'Hold longer than feels safe on the turn; silence is a tool.',
      'Iris transitions sparingly, into a revelation.',
      'Gold (accent) only for the thing the viewer must remember.',
    ],
  },
  {
    id: 'kinetic',
    title: 'Kinetic manifesto',
    when: 'Social cuts, launches, opinion pieces, hooks that must stop a scroll',
    film: {
      theme: 'pop',
      backdrop: 'none',
      texture: { grain: 0.25 },
      motion: { preset: 'snappy', intensity: 0.9 },
      transition: 'cut',
      sfx: 'punchy',
      voice: { style: 'energetic, punchy, playful', takes: 'chapter' },
    },
    beats: { kinetic: 'stack', emphasisStyle: 'serif', graphic: 'whip' },
    rules: [
      'Words are the picture: kinetic stack with 1–2 emphasis words per phrase.',
      'Cut on the beat; whip or panel only between ideas.',
      'Tone scenes as punctuation every 10–15 s.',
      'Phrases of 3–6 words; nothing on screen longer than it takes to say.',
    ],
  },
  {
    id: 'sketchbook',
    title: 'Hand-drawn explainer',
    when: 'How things work, lessons, stories for curious beginners, whiteboard-style explainers',
    film: {
      theme: 'sketchbook',
      backdrop: 'paper',
      texture: { grain: 0.35, vignette: 0.35 },
      motion: { preset: 'spring', intensity: 0.7 },
      transition: 'cut',
      sfx: 'subtle',
      voice: { style: 'friendly, curious, like explaining to a friend', takes: 'chapter' },
    },
    beats: { rough: { amount: 2.2, passes: 2, boil: 8 }, font: 'hand', fps: 12 },
    rules: [
      'Draw the mechanism on canvas; strokes draw on as they are named.',
      'Hand lettering (font: hand) for labels; keep display type for the one big word.',
      'Red pencil (accent) for the subject, blue (accent2) for motion trails and notes.',
      'Stepped motion (fps 12) and a gentle line boil make it feel drawn, not rendered.',
    ],
  },
  {
    id: 'blueprint',
    title: 'Blueprint how-it-works',
    when: 'Engineering, systems, architecture, technical walkthroughs',
    film: {
      theme: 'blueprint',
      backdrop: 'grid',
      texture: { vignette: 0.4 },
      motion: { preset: 'snappy', intensity: 0.7 },
      transition: 'push',
      frame: { brand: 'Spec', left: 'Fig.', right: '' },
      sfx: 'subtle',
      voice: { style: 'precise, calm, engaged', takes: 'chapter' },
    },
    beats: { font: 'mono', graphic: 'wipe' },
    rules: [
      'Every part is labelled in mono; lines draw on in the order the voice names them.',
      'Use scramble for technical terms, dash loops for flow, along for packets.',
      'One system diagram built across several beats beats many small ones (morph by id).',
    ],
  },
  {
    id: 'audiogram',
    title: 'Podcast audiogram',
    when: 'Clips from interviews and podcasts, conversations, talks',
    film: {
      theme: 'electric',
      backdrop: 'glow',
      texture: { grain: 0.3, vignette: 0.5 },
      motion: { preset: 'snappy', intensity: 0.75 },
      transition: 'cut',
      sfx: 'off',
      voice: { takes: 'chapter' },
    },
    beats: { kinetic: 'highlight', graphic: 'whip' },
    rules: [
      'The recording is the spine: never edit vo; give the moments pictures.',
      'Speaker tags on every voiced beat; a meter (style mirror) where the words are not enough.',
      'Pull the best line out as a quote or kinetic stack; literalise one concrete noun every 8–15 s with a canvas drawing.',
      'Open on the hook moment, not the introduction.',
    ],
  },
  {
    id: 'brand',
    title: 'Designed spot',
    when: 'Brand intros, announcements, product moments, channel openers',
    film: {
      theme: 'paper',
      backdrop: 'none',
      texture: { grain: 0.3 },
      motion: { preset: 'spring', intensity: 0.85 },
      transition: 'cut',
      frame: { brand: 'brand', left: '', right: '' },
      sfx: 'normal',
      voice: { style: 'bright, confident', takes: 'chapter' },
    },
    beats: { emphasisStyle: 'serif', graphic: 'iris' },
    rules: [
      'A persistent frame (brand, section label, footers) makes every scene feel designed.',
      'Echo trails and stepped copies turn one shape into a composition.',
      'Carry the hero object across cuts with morph by id or an iris from its position.',
    ],
  },
  {
    id: 'calm',
    title: 'Quiet lesson',
    when: 'Wellbeing, reflective stories, gentle tutorials, children',
    film: {
      theme: 'forest',
      backdrop: 'glow',
      texture: { grain: 0.2 },
      motion: { preset: 'gentle', intensity: 0.35 },
      transition: 'fade',
      sfx: 'off',
      voice: { style: 'soft, slow, reassuring', takes: 'chapter' },
    },
    beats: { graphic: 'fade' },
    rules: [
      'Slow everything: long holds, ambient art under the words, no graphic transitions.',
      'Nothing flashes; values count slowly; one idea per scene.',
    ],
  },
];
export const treatmentById = id => TREATMENTS.find(t => t.id === id);

/**
 * Apply a treatment to a storyboard: film-level look plus beat defaults the author has not
 * set. Returns the storyboard (mutated) so `new` can write it.
 */
export function applyTreatment(sb, id) {
  const t = treatmentById(id);
  if (!t) throw new Error(`Unknown treatment ${id}. Run clearframe treatments.`);
  const { voice, ...film } = t.film;
  Object.assign(sb, structuredClone(film));
  if (voice) sb.voice = { ...(sb.voice ?? {}), ...voice };
  if (film.frame?.brand === 'brand') sb.frame.brand = sb.title ?? 'Brand';
  const chapterStarts = new Set(
    sb.beats.map((b, i) => (i && b.chapter && b.chapter !== sb.beats[i - 1].chapter ? i : -1)),
  );
  sb.beats.forEach((b, i) => {
    const p = b.props ?? {};
    if (t.beats.emphasisStyle && ['title', 'statement', 'endcard'].includes(b.block) && p.emphasis && !p.emphasisStyle)
      p.emphasisStyle = t.beats.emphasisStyle;
    if (t.beats.kinetic && b.block === 'kinetic' && !p.mode) p.mode = t.beats.kinetic;
    if (b.block === 'canvas' && t.beats.rough && p.rough == null) p.rough = t.beats.rough;
    if (b.block === 'canvas')
      for (const el of p.elements ?? []) {
        if (t.beats.font && el.type === 'text' && !el.font && (el.size ?? 48) < 90) el.font = t.beats.font;
        if (t.beats.fps && el.fps == null && (el.keys || el.loop || el.along)) el.fps = t.beats.fps;
      }
    if (t.beats.graphic && chapterStarts.has(i) && !b.transition) b.transition = t.beats.graphic;
  });
  sb.treatment = id;
  return sb;
}

/** The direction brief `new` writes next to a storyboard. */
export function directionTemplate(sb, t) {
  return `# Direction: ${sb.title}

Treatment: **${t ? `${t.id} — ${t.title}` : 'none (choose one: clearframe treatments)'}**

## Audience and takeaway
- Who is watching, and what do they already believe?
- The one thing they should understand or do afterwards:

## Reference
- Link or file of a video whose feel to borrow. Run \`clearframe reference VIDEO\` and read REFERENCE.md.
- **Keep** (timing, pacing, camera, transitions, type roles):
- **Change** (brand colours, copy, subject, length):

## Story spine
- The question the film answers:
- The misconception or tension it starts from:
- The turn ("but…"):
- The payoff, and the last image:

## Beat plan
| Beat | Purpose | Picture (block, canvas sketch, plate) | Landing word |
|---|---|---|---|
| hook | stop the scroll | | |

${t ? `## Treatment rules\n${t.rules.map(r => `- ${r}`).join('\n')}\n` : ''}
## Before rendering
- \`sheet\` at three moments per beat; \`critique\` for rhythm and density; a fresh reviewer reads the sheet against this brief.
`;
}
