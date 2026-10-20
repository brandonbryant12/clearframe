import { revise } from './edit-loop.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { rel, list, printImpact, json } from './review-command-common.mjs';
export async function reviseCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  if (!o.note)
    throw new Error('revise needs --note n001 (record the note first).');

  const r = await revise(dir, {
    note: o.note,
    scope: o.scope,
    reason: o.reason,
    handles: o.handles == null ? 2 : Number(o.handles),
    overrides: list(o.override) ?? [],
    label: o.label,
  });

  if (o.json) return json(r);

  return console.log(
    [
      `candidate ${r.revision} for ${r.note} (applied, not accepted) · scope ${r.declared.film ? 'film' : r.declared.beats.join(', ')}`,
      printImpact(r.report),
      ...r.passages.map(
        (p, i) =>
          `passage ${i + 1}: ${p.beats.join(', ')}${p.removed.length ? ` (removed ${p.removed.join(', ')})` : ''}\n  before ${p.before ? rel(p.before.output) : '—'}\n  after  ${p.after ? rel(p.after.output) : '—'}${p.after?.verified ? `  (clock checked: ${p.after.verified.map((v) => `${v.psnr != null && Number.isFinite(v.psnr) ? v.psnr.toFixed(1) : '∞'} dB`).join(', ')})` : ''}`,
      ),
      ...(r.unrendered
        ? [
            `${r.unrendered} more changed stretch(es) not rendered here: preview DIR --beats … for each`,
          ]
        : []),
      `compare page: ${rel(r.page)}`,
      'Ask the person to accept, refine or reject it; record their reply with accept/reject.',
    ].join('\n'),
  );
}
