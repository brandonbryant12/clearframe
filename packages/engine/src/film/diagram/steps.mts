import type {
  DiagramSpec,
  DiagramOptions,
  NodeState,
  EdgeState,
  Send,
} from './contracts.mjs';
import { check, object, STEP_KEYS, list, TIME, required } from './shared.mjs';
import { diagramClock, statusOk } from './cues.mjs';
export function stepDiagram(
  input: DiagramSpec,
  N: Map<string, NodeState>,
  E: Map<string, EdgeState>,
  resolve: DiagramOptions['resolve'],
): Send[] {
  const { steps = [] } = input;
  const { time } = diagramClock(resolve);
  const thing = (id: string) => N.get(id) ?? E.get(id);
  // ---- steps: changes to the same cast over time
  const sends: Send[] = [];
  const scheduled = steps.map((s, i) => {
    object(s, STEP_KEYS, `steps[${i}]`);
    check(
      (s.at == null) !== (s.say == null),
      `steps[${i}] needs at (seconds) or say (spoken cue)`,
    );
    const ops = (['add', 'remove', 'replace', 'set', 'send'] as const).filter(
      (k) => s[k] != null,
    );
    check(
      ops.length === 1,
      `steps[${i}] takes exactly one of add, remove, replace, set, send`,
    );
    check(
      s.with == null || s.replace != null,
      `steps[${i}].with belongs to replace`,
    );
    check(
      s.label == null || s.send != null,
      `steps[${i}].label belongs to send`,
    );
    check(
      s.dur == null ||
        (s.send != null &&
          Number.isFinite(s.dur) &&
          s.dur >= 0.2 &&
          s.dur <= 4),
      `steps[${i}].dur is the seconds per send hop, 0.2–4`,
    );
    return { ...s, t: time(s.at ?? s.say) ?? 0, i };
  });
  scheduled.sort((a, b) => a.t - b.t || a.i - b.i);
  const enter = (id: string, t: number, where: string) => {
    const x = thing(id);
    check(x, `${where}: unknown id ${id}`);
    check(
      !x.timed && !x.stepped,
      `${where}: ${id} is already timed; cue it on the node/edge or in one step`,
    );
    x.at = t;
    x.stepped = true;
    if (N.has(id)) x.status[0][1] ??= 'added';
  };
  const leave = (id: string, t: number, where: string) => {
    const x = thing(id);
    check(x, `${where}: unknown id ${id}`);
    check(x.exitAt == null, `${where}: ${id} already has an exit`);
    x.status.push([t, 'removed']);
    x.exitAt = t + TIME.remove;
  };
  for (const s of scheduled) {
    const where = `steps[${s.i}]`;
    if (s.add != null)
      list(s.add).forEach((id, k) => enter(id, s.t + k * TIME.stagger, where));
    if (s.remove != null) list(s.remove).forEach((id) => leave(id, s.t, where));
    if (s.replace != null)
      replaceNode(s.replace, s.with, s.t, where, N, enter, leave);
    if (s.set != null) {
      object(s.set, [...N.keys(), ...E.keys()], `${where}.set`);
      for (const [id, status] of Object.entries(s.set)) {
        statusOk(status, `${where}.set.${id}`);
        required(thing(id), id).status.push([s.t, status]);
      }
    }
    if (s.send != null) {
      check(
        Array.isArray(s.send) &&
          s.send.length >= 2 &&
          s.send.every((id) => N.has(id)),
        `${where}.send must list 2 or more node ids along connections`,
      );
      sends.push({
        path: s.send,
        t: s.t,
        label: s.label,
        hop: s.dur ?? TIME.hop,
        where,
      });
    }
  }

  return sends;
}

function replaceNode(
  replaced: string,
  replacement: string | undefined,
  at: number,
  where: string,
  N: Map<string, NodeState>,
  enter: (id: string, t: number, where: string) => void,
  leave: (id: string, t: number, where: string) => void,
): void {
  check(
    replacement && N.has(replaced) && N.has(replacement),
    `${where}: replace needs existing node ids in replace and with`,
  );
  leave(replaced, at, where);
  enter(replacement, at + TIME.remove, where);
  const n = required(N.get(replacement), replacement);
  if (n.x == null && n.replaces == null) n.replaces = replaced;
}
