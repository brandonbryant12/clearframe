import type { Storyboard, Beat } from '../engine/domain.mjs';
import type { TreatmentItem, TreatmentBeats } from './types.mjs';
import * as Schema from 'effect/Schema';
import { CameraCueSchema } from '../engine/schemas.mjs';
interface TreatmentOptions {
  recording?: boolean;
  variant?: string | number | null;
}
// Treatments: coherent art direction in one word. A treatment sets the film-level look
// (palette, backdrop, texture, frame, motion, transitions, voice, sound) and beat defaults
// (serif emphasis, rough strokes, kinetic mode), plus short rules for the author. They are
// starting directions to adapt, like playbooks are starting arcs.
import { items, item } from './library.mjs';

/** Every treatment (built-in library/treatments plus any in the project's library/). */
export const treatments = () => items('treatments');
export const treatmentById = (id: string) => item('treatments', id);

/**
 * Apply a treatment to a storyboard: film-level look plus beat defaults the author has not
 * set. Returns the storyboard (mutated) so `new` can write it.
 */
/** The variant a project gets: the same key always picks the same look. */
export function pickVariant<A>(
  variants: readonly A[] | undefined,
  key: string | number | null | undefined,
): A | null {
  if (!Array.isArray(variants) || !variants.length || key == null) return null;
  let h = 2166136261;
  for (const c of String(key))
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return variants[h % variants.length];
}

export function applyTreatment<T extends Storyboard>(
  sb: T,
  id: string,
  { recording = false, variant }: TreatmentOptions = {},
): T {
  const found = treatmentById(id);
  if (!found)
    throw new Error(`Unknown treatment ${id}. Run clearframe treatments.`);
  // A treatment may offer whole looks (palette, type voice, drawing style) to choose between, so
  // two films from one treatment don't share a face; `variant` is a project key (its folder name
  // or seed) and always picks the same look.
  const v = pickVariant(found.variants, variant);
  const t = v
    ? {
        ...found,
        film: { ...found.film, ...(v.film ?? {}) },
        beats: { ...(found.beats ?? {}), ...(v.beats ?? {}) },
        look: v.name,
      }
    : { ...found, beats: found.beats ?? {} };
  const { voice, ...film } = t.film;
  // A playbook's own cutting (cut, push) is part of its grammar: the treatment's film-wide
  // transition only replaces the default fade, never a playbook's choice.
  const cutting =
    sb.transition && sb.transition !== 'fade' ? sb.transition : null;
  const visual = [
    'theme',
    'type',
    'backdrop',
    'texture',
    'motion',
    'textMotion',
    'frame',
    'sfx',
    'lens',
    'camera',
    'heading',
    'chrome',
  ];
  Object.assign(
    sb,
    structuredClone(
      recording
        ? Object.fromEntries(
            Object.entries(film).filter(([key]) => visual.includes(key)),
          )
        : film,
    ),
  );
  if (cutting) sb.transition = cutting;
  if (voice && !recording) sb.voice = { ...(sb.voice ?? {}), ...voice };
  const chapterStarts = new Set(
    sb.beats.map((b, i) =>
      i && b.chapter && b.chapter !== sb.beats[i - 1].chapter ? i : -1,
    ),
  );
  sb.beats.forEach((b, i) => {
    applyBeatTreatment(b, t.beats);
    if (!recording && t.beats.graphic && chapterStarts.has(i) && !b.transition)
      b.transition = t.beats.graphic;
  });
  sb.treatment = id;
  return sb;
}

/** The direction brief `new` writes next to a storyboard. */
export function directionTemplate(
  sb: Pick<Storyboard, 'title'>,
  t: TreatmentItem | null | undefined,
): string {
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

${t ? `## Treatment rules\n${(t.rules ?? []).map((r) => `- ${r}`).join('\n')}\n` : ''}
## Before rendering
- \`sheet\` at three moments per beat; \`critique\` for rhythm and density; a fresh reviewer reads the sheet against this brief.
`;
}

function applyBeatTreatment(b: Beat, treatment: TreatmentBeats): void {
  const p = b.props ?? {};
  if (treatment.camera != null)
    b.camera ??=
      typeof treatment.camera === 'string'
        ? treatment.camera
        : Schema.decodeUnknownSync(CameraCueSchema)(treatment.camera);
  if (
    treatment.emphasisStyle &&
    ['title', 'statement', 'endcard'].includes(b.block ?? '') &&
    p.emphasis &&
    !p.emphasisStyle
  )
    p.emphasisStyle = treatment.emphasisStyle;
  if (treatment.kinetic && b.block === 'kinetic' && !p.mode)
    p.mode = treatment.kinetic;
  if (b.block === 'canvas') applyCanvasTreatment(p, treatment);
}
function applyCanvasTreatment(
  p: NonNullable<Beat['props']>,
  treatment: TreatmentBeats,
): void {
  if (treatment.rough && p.rough == null) p.rough = treatment.rough;
  // A film look draws clean lines: it strips the pencil strokes an arc was scaffolded with.
  if (treatment.rough === false) delete p.rough;
  if (treatment.mosaic && p.mosaic == null) p.mosaic = treatment.mosaic;
  if (treatment.print && p.print == null) p.print = treatment.print;
  for (const el of p.elements ?? []) {
    if (
      treatment.font &&
      el.type === 'text' &&
      !el.font &&
      (el.size ?? 48) < 90
    )
      el.font = treatment.font;
    if (treatment.fps && el.fps == null && (el.keys || el.loop || el.along))
      el.fps = treatment.fps;
  }
}
