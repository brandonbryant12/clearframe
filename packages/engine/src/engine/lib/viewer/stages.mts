import type { Storyboard } from '../../domain.mjs';
import type { ViewerVersion } from './contracts.mjs';
// Where a film is in production, from what exists on disk:
// pre-production (brief, script, storyboard) → production (rough cut) → post-production (in review, final).
export const STAGES = [
  // `next` is what the person looking at the film can do now, in their words.
  {
    id: 'brief',
    label: 'Brief',
    phase: 'Pre-production',
    next: 'Read the brief, then ask for a first cut',
  },
  {
    id: 'script',
    label: 'Script',
    phase: 'Pre-production',
    next: 'Read the script and leave notes',
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    phase: 'Pre-production',
    next: 'Look through the scenes and leave notes',
  },
  {
    id: 'rough',
    label: 'Rough cut',
    phase: 'Production',
    next: 'Watch it and leave notes',
  },
  {
    id: 'review',
    label: 'In review',
    phase: 'Post-production',
    next: 'Send your notes to the agent',
  },
  {
    id: 'final',
    label: 'Final',
    phase: 'Post-production',
    next: 'Ready to share',
  },
];
export const PHASES = ['Pre-production', 'Production', 'Post-production'];

const isTitle = (b: Storyboard['beats'][number]) =>
  ['title', 'endcard', 'chapter'].includes(b.block ?? '');

/** The stage of a ClearFrame project: its storyboard and the profile of its latest render. */
export function clearframeStage(
  sb: Storyboard | null | undefined,
  latest?: Pick<ViewerVersion, 'profile' | 'placeholders'> | null,
  openNotes = 0,
) {
  if (!sb?.beats?.length) return 'brief';
  if (latest) {
    if (latest.profile === 'rough' || latest.placeholders?.length)
      return 'rough';
    if (latest.profile === 'final') return openNotes ? 'review' : 'final';
    return 'review';
  }
  const body = sb.beats.filter((b) => !isTitle(b)),
    placeholders = body.filter((b) => b.placeholder).length;
  return body.length && placeholders / body.length >= 0.5
    ? 'script'
    : 'storyboard';
}

/** A film.json may name its stage; otherwise a Final latest version is final and anything else is in review. */
export function manifestStage(
  m: { stage?: string },
  versions: readonly (Pick<ViewerVersion, 'quality'> &
    Partial<Pick<ViewerVersion, 'notes'>>)[],
) {
  const latest = versions.at(-1);
  if (
    latest?.notes?.some((n) => !n.resolved) &&
    (m.stage === 'final' || latest.quality === 'Final')
  )
    return 'review';
  if (STAGES.some((s) => s.id === m.stage)) return m.stage;
  if (latest?.quality === 'Final') return 'final';
  return versions.length ? 'review' : 'storyboard';
}

export function stageInfo(
  id: string | undefined,
  { openNotes = 0 }: { openNotes?: number } = {},
) {
  const s = STAGES.find((x) => x.id === id) ?? STAGES[0];
  let next = s.next;
  if (id === 'review' && !openNotes)
    next = 'Watch it, then approve it or leave notes';
  if (id === 'final' && openNotes) next = 'Send your notes to the agent';
  return {
    id: s.id,
    label: s.label,
    phase: s.phase,
    index: STAGES.indexOf(s),
    next,
  };
}
