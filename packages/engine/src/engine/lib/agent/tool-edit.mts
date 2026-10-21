import { studioState, studioCommand, planOps } from '../viewer/studio.mjs';
import { touched } from './agent.mjs';
import { scopeViolation } from './tool-scope.mjs';
import { opsFromText } from './tool-json.mjs';
import type { ToolOptions, ToolHandlers } from './contracts.mjs';
import { fail, clip } from './tool-common.mjs';

export function createEditTools({
  pauseOf,
  currentScope,
}: ToolOptions): ToolHandlers {
  return {
    async edit({ dir, input, sessionID, messageID }) {
      const paused = pauseOf(dir);
      if (paused)
        throw fail(
          `${paused.label} is using the working copy. Wait for it (clearframe_job) before editing.`,
          409,
        );
      if (typeof input.label !== 'string' || !input.label.trim())
        throw fail('Give the change a short label for the undo history.');
      // Some models send the operations as JSON text; accept that, refuse anything else.
      if (typeof input.ops === 'string') input.ops = opsFromText(input.ops);
      const plan = planOps(dir, input.ops);
      if (input.hash !== plan.hash)
        throw fail(
          'The film changed since you read it (the person or another editor saved a change). Call clearframe_state and make your change on the current version.',
          409,
        );
      // Which request this call answers, from the call's own message: fails closed when it cannot be told.
      const { scope, run } = await currentScope(sessionID, messageID);
      const runEdited = studioState(dir).history.some(
        (h) => h.run === run && h.applied,
      );
      const outside = scopeViolation(scope, plan.before, plan.after, {
        runEdited,
      });
      if (outside)
        throw fail(
          `Not saved: the person limited this request to ${scope.label ?? scope.kind}, and this change ${outside}. Make the change inside that scope; if the request needs more, describe the broader change in your reply and ask the person to widen the scope (they choose Whole film in the composer). Never apply it without them.`,
          409,
        );
      const t = touched(plan.before, plan.after);
      const label = clip(input.label.trim(), 100);
      // Scope resolution crosses the runtime boundary. A render may have queued while we waited.
      const nowPaused = pauseOf(dir);
      if (nowPaused)
        throw fail(
          `${nowPaused.label} is using the working copy. Wait for it (clearframe_job) before editing.`,
          409,
        );
      const r = studioCommand(
        dir,
        { command: 'batch', ops: input.ops, hash: plan.hash, label },
        { actor: { by: 'agent', run } },
      );
      if ('plan' in r) throw fail('A batch edit returned a recording plan.');
      if (r.hash === plan.hash)
        return {
          content: 'Nothing changed: the storyboard already says that.',
          metadata: { summary: 'No change', hash: r.hash },
        };
      const where = t.beats.length
        ? `scenes ${t.beats.join(', ')}`
        : 'film settings';
      return {
        content: [
          `Saved “${label}” as one undoable step (${where}${t.film && t.beats.length ? ' and film settings' : ''}).`,
          `New hash: ${r.hash}`,
          r.errors.length
            ? `Engine errors now: ${r.errors.slice(0, 6).join('; ')}`
            : 'Engine accepts the working copy.',
          r.warnings.length
            ? `Warnings: ${r.warnings.slice(0, 4).join('; ')}`
            : null,
          'created' in r && r.created?.length
            ? `Created: ${r.created.join(', ')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        metadata: {
          summary: `${label} · ${where}`,
          beats: t.beats,
          hash: r.hash,
          run,
        },
      };
    },
  };
}
