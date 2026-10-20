import type {
  BeatChange,
  TakeChange,
  Timeline,
  TimelineBeat,
} from './revisions-model.mjs';
import {
  type Compare,
  round,
  sameRange,
  fmtShift,
  clip,
} from './revisions-impact-common.mjs';

export function addedChange(c: Compare, b: TimelineBeat): BeatChange {
  const was = (b.was ?? c.lineage?.added?.[b.id]?.from ?? []).filter((id) =>
    c.before.has(id),
  );
  if (b.world) c.worldsChanged.add(b.world);
  return {
    id: b.id,
    status: 'added',
    from: was,
    reasons: [was.length ? `made from ${was.join(' + ')}` : 'new beat'],
  };
}

export function contentChange(
  c: Compare,
  a: TimelineBeat,
  b: TimelineBeat,
  merged: string[],
): BeatChange {
  const kinds = (
    ['picture', 'words', 'audio', 'facts', 'voice'] as const
  ).filter((k) => a.prints[k] !== b.prints[k]);
  if (b.world) c.worldsChanged.add(b.world);
  return {
    id: b.id,
    status: 'content',
    changed: [...kinds],
    reasons: [
      kinds.length
        ? `${kinds.join(', ')} changed`
        : 'authored settings changed',
      ...(merged.length ? [`absorbed ${merged.join(', ')}`] : []),
    ],
    shift: round(b.start - a.start),
    durationDelta: round(b.end - b.start - (a.end - a.start)),
  };
}

export function couplingReasons(
  a: TimelineBeat,
  b: TimelineBeat,
  reasons: string[],
): void {
  const ca = a.coupling ?? {},
    cb = b.coupling ?? {};
  if (ca.exit !== cb.exit)
    reasons.push(
      `its exit is now ${cb.exit} (it mirrors the next beat’s entrance)`,
    );
  if (ca.continues !== cb.continues)
    reasons.push(
      cb.continues
        ? 'its speaker tag now continues from the beat before'
        : 'its speaker tag now introduces the speaker',
    );
  if (
    ca.handoff !== cb.handoff ||
    (cb.handoff && a.prints.own !== b.prints.own && !reasons.length)
  )
    reasons.push('the camera hand-off with a neighbouring world beat changed');
  if (ca.morph !== cb.morph)
    reasons.push('a morph from the beat before changed');
}

export function appearanceChange(
  c: Compare,
  a: TimelineBeat,
  b: TimelineBeat,
): BeatChange {
  const { A, B } = c;
  const reasons: string[] = [];
  if (c.global.includes('look')) reasons.push('film look changed');
  if (c.global.includes('renderer'))
    reasons.push(
      (A.printScheme ?? 0) !== (B.printScheme ?? 0)
        ? 'recorded by another ClearFrame version; look again'
        : 'renderer or fonts changed',
    );
  const prevB: TimelineBeat | undefined = B.beats[b.index - 1];
  const prevA = prevB && c.before.get(prevB.id);
  if (
    b.transition !== 'cut' &&
    prevB &&
    (!prevA || prevA.prints.own !== prevB.prints.own)
  )
    reasons.push(
      `its ${b.transition} entrance draws ${prevB.id}, which changed`,
    );
  if (b.world && c.worldsChanged.has(b.world))
    reasons.push(`it shares world “${b.world}” with a changed beat`);
  couplingReasons(a, b, reasons);
  if (a.prints.own !== b.prints.own && !reasons.length)
    reasons.push(
      'its prepared scene changed (timing-derived cues or a neighbour’s influence)',
    );
  if (b.world) c.worldsChanged.add(b.world);
  return {
    id: b.id,
    status: 'appearance',
    reasons,
    shift: round(b.start - a.start),
  };
}

export function beatChange(c: Compare, b: TimelineBeat): BeatChange {
  const a = c.before.get(b.id);
  if (!a) return addedChange(c, b);
  const merged = (b.was ?? []).filter(
    (id) => id !== b.id && c.before.has(id) && !c.after.has(id),
  );
  if (a.prints.authored !== b.prints.authored || merged.length)
    return contentChange(c, a, b, merged);
  if (a.prints.rendered !== b.prints.rendered) return appearanceChange(c, a, b);
  if (!sameRange(a, b))
    return {
      id: b.id,
      status: 'shifted',
      shift: round(b.start - a.start),
      reasons: [`moved ${fmtShift(b.start - a.start)}`],
    };
  return { id: b.id, status: 'unchanged' };
}

export function removedChanges(c: Compare): BeatChange[] {
  return c.A.beats
    .filter((a) => !c.after.has(a.id))
    .map((a): BeatChange => {
      const l = c.lineage?.removed?.[a.id];
      const into =
        l?.into ??
        c.B.beats.filter((b) => (b.was ?? []).includes(a.id)).map((b) => b.id);
      const cutBy = l?.by
        ? `cut by ${l.by} (“${clip(l.words, 60)}”)`
        : 'removed';
      return {
        id: a.id,
        status: 'removed',
        into,
        reasons: [into.length ? `became ${into.join(' + ')}` : cutBy],
        text: a.vo?.text ?? null,
      };
    });
}

// Narration that changed under a generated take re-records the whole take.
export function takeChanges(
  beats: BeatChange[],
  after: Map<string, TimelineBeat>,
  B: Timeline,
): TakeChange[] {
  const takes: TakeChange[] = [];
  for (const x of beats.filter(
    (y) => y.status === 'content' && y.changed?.includes('words'),
  )) {
    const b = after.get(x.id);
    const take = b?.vo?.plannedTake;
    if (!take || b.source) continue;
    let t = takes.find((y) => y.take === take);
    if (!t)
      takes.push(
        (t = {
          take,
          beats: B.beats
            .filter((y) => y.vo?.plannedTake === take)
            .map((y) => y.id),
          because: [],
        }),
      );
    t.because.push(x.id);
  }
  return takes;
}
