// Where a film is in production, from what exists on disk:
// pre-production (brief, script, storyboard) → production (rough cut) → post-production (in review, final).
export const STAGES = [
  { id: 'brief', label: 'Brief', phase: 'Pre-production', next: 'Write the script and a scene list' },
  { id: 'script', label: 'Script', phase: 'Pre-production', next: 'Design each scene from the templates' },
  { id: 'storyboard', label: 'Storyboard', phase: 'Pre-production', next: 'Record a draft voice and render a rough cut' },
  { id: 'rough', label: 'Rough cut', phase: 'Production', next: 'Replace placeholders, then render a draft for review' },
  { id: 'review', label: 'In review', phase: 'Post-production', next: 'Address the open notes' },
  { id: 'final', label: 'Final', phase: 'Post-production', next: 'Deliver' },
];
export const PHASES = ['Pre-production', 'Production', 'Post-production'];

const isTitle = b => ['title', 'endcard', 'chapter'].includes(b.block);

/** The stage of a ClearFrame project: its storyboard and the profile of its latest render. */
export function clearframeStage(sb, latest, openNotes = 0) {
  if (!sb?.beats?.length) return 'brief';
  if (latest) {
    if (latest.profile === 'rough' || latest.placeholders?.length) return 'rough';
    if (latest.profile === 'final') return openNotes ? 'review' : 'final';
    return 'review';
  }
  const body = sb.beats.filter(b => !isTitle(b)), placeholders = body.filter(b => b.placeholder).length;
  return body.length && placeholders / body.length >= 0.5 ? 'script' : 'storyboard';
}

/** A film.json may name its stage; otherwise a Final latest version is final and anything else is in review. */
export const manifestStage = (m, versions) => versions.at(-1)?.notes?.some(n => !n.resolved) && (m.stage === 'final' || versions.at(-1)?.quality === 'Final') ? 'review' : STAGES.some(s => s.id === m.stage) ? m.stage : versions.at(-1)?.quality === 'Final' ? 'final' : versions.length ? 'review' : 'storyboard';

export function stageInfo(id, { openNotes = 0 } = {}) {
  const s = STAGES.find(x => x.id === id) ?? STAGES[0];
  const next = id === 'review' && !openNotes ? 'Render the final' : id === 'final' && openNotes ? 'Address the open notes' : s.next;
  return { id: s.id, label: s.label, phase: s.phase, index: STAGES.indexOf(s), next };
}
