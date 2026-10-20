import type { CheckpointState } from './checkpoints-state.mjs';
import type { Decision } from './notes-model.mjs';
const said = (d: Decision | null | undefined): string =>
  d?.role === 'human'
    ? `accepted by ${d.by} (${d.id}, ${d.revision})`
    : `decided by the agent (${d?.id}, ${d?.revision}), not a person's acceptance`;
export function roughDetail(rough: CheckpointState['rough']): string {
  if (!rough.latest) return 'no rough cut yet (draft DIR --rough)';
  return [
    `${rough.latest.id} (${rough.latest.placeholders?.length ?? 0} placeholder(s))`,
    rough.human || rough.agent ? said(rough.human ?? rough.agent) : null,
    rough.notes.length
      ? `${rough.notes.length} note(s) from the person`
      : 'no notes from the person yet',
  ]
    .filter(Boolean)
    .join('; ');
}
export function spendDetail(state: CheckpointState): string {
  if (!state.owed) return 'nothing paid pending';
  const budget = state.sb.budget != null ? ` (budget $${state.sb.budget})` : '';
  const decision = state.decided('Spend', 'Budget') ? '; decision logged' : '';
  return `≈ $${state.owed.toFixed(2)} of paid generation pending${budget}${decision}`;
}
export function narrationDetail(state: CheckpointState): string {
  if (!state.pending.some((r) => r.kind === 'voice')) return 'voiced';
  return state.drafted ? 'draft voice only' : 'not yet voiced';
}
export function sheetDetail(sheet: number, edited: number): string {
  if (!sheet) return 'no sheet yet';
  return sheet > edited
    ? 'sheet is current'
    : 'storyboard changed since the sheet';
}
