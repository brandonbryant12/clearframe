// Treatments: coherent art direction in one word. A treatment sets the film-level look
// (palette, backdrop, texture, frame, motion, transitions, voice, sound) and beat defaults
// (serif emphasis, rough strokes, kinetic mode), plus short rules for the author. They are
// starting directions to adapt, like playbooks are starting arcs.
import { items, item } from './library.mjs';

/** Every treatment (built-in library/treatments plus any in the project's library/). */
export const treatments = () => items('treatments');
export const treatmentById = id => item('treatments', id);

/**
 * Apply a treatment to a storyboard: film-level look plus beat defaults the author has not
 * set. Returns the storyboard (mutated) so `new` can write it.
 */
export function applyTreatment(sb, id) {
  const found = treatmentById(id);
  if (!found) throw new Error(`Unknown treatment ${id}. Run clearframe treatments.`);
  const t = { ...found, beats: found.beats ?? {} };
  const { voice, ...film } = t.film;
  // A playbook's own cutting (cut, dissolve) is part of its grammar: the treatment's film-wide
  // transition only replaces the default fade, never a playbook's choice.
  const cutting = sb.transition && sb.transition !== 'fade' ? sb.transition : null;
  Object.assign(sb, structuredClone(film));
  if (cutting) sb.transition = cutting;
  if (voice) sb.voice = { ...(sb.voice ?? {}), ...voice };
  if (film.frame?.brand === 'brand' && sb.frame) sb.frame.brand = sb.title ?? 'Brand';
  const chapterStarts = new Set(
    sb.beats.map((b, i) => (i && b.chapter && b.chapter !== sb.beats[i - 1].chapter ? i : -1)),
  );
  sb.beats.forEach((b, i) => {
    const p = b.props ?? {};
    if (t.beats.emphasisStyle && ['title', 'statement', 'endcard'].includes(b.block) && p.emphasis && !p.emphasisStyle)
      p.emphasisStyle = t.beats.emphasisStyle;
    if (t.beats.kinetic && b.block === 'kinetic' && !p.mode) p.mode = t.beats.kinetic;
    if (b.block === 'canvas' && t.beats.rough && p.rough == null) p.rough = t.beats.rough;
    // A film look draws clean lines: it strips the pencil strokes an arc was scaffolded with.
    if (b.block === 'canvas' && t.beats.rough === false) delete p.rough;
    if (b.block === 'canvas' && t.beats.mosaic && p.mosaic == null) p.mosaic = t.beats.mosaic;
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

${t ? `## Treatment rules\n${(t.rules ?? []).map(r => `- ${r}`).join('\n')}\n` : ''}
## Before rendering
- \`sheet\` at three moments per beat; \`critique\` for rhythm and density; a fresh reviewer reads the sheet against this brief.
`;
}
