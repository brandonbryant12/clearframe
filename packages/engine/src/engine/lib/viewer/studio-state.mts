import { decodeStoryboard } from '../../schemas.mjs';
import { read, sha, loadHistory, aligned } from './studio-history.mjs';
import { analyse, narrationOf, changesSince } from './studio-analysis.mjs';
export function studioState(dir: string) {
  const raw = read(dir),
    sb = decodeStoryboard(JSON.parse(raw)),
    h = loadHistory(dir, raw),
    ok = aligned(h, raw);
  const at = h.entries[h.cursor - 1],
    next = h.entries[h.cursor];
  const a = analyse(dir, sb, raw);
  return {
    storyboard: sb,
    hash: sha(raw),
    canUndo: ok && h.cursor > 0 && at?.undo !== false,
    canRedo: ok && h.cursor < h.entries.length && next?.redo !== false,
    undoLabel: ok && at ? at.label : null,
    redoLabel: ok && next ? next.label : null,
    history: h.entries.map(({ label, at, kind, by, run }, i) => ({
      label,
      at,
      kind: kind ?? 'edit',
      by: by ?? 'person',
      run: run ?? null,
      applied: i < h.cursor,
    })),
    externalChanges: !ok,
    timing: a.timing,
    errors: a.errors,
    warnings: a.warnings,
    boxes: a.boxes,
    narration: Object.fromEntries(
      sb.beats.map((b) => [b.id, narrationOf(dir, b)]),
    ),
    changes: changesSince(dir, sb),
  };
}
