import type { JobBeat } from './types.mjs';

export function worldCameraTime(
  a: JobBeat,
  b: JobBeat,
  fps: number,
  adjacent: boolean,
): number {
  const viewDur = b.props.viewDur ?? 1.2;
  b.props.viewDur = viewDur;
  const subjects = (b.props.elements ?? []).filter(
    (el) => !el.carried && !el.behind && el.enter !== 'none',
  );
  const firstNew = Math.min(...subjects.map((el) => el.at ?? 0));
  const firstWord = b.words?.find((w) => w.end > w.start)?.start ?? Infinity;
  const land = Math.max(0.25, Math.min(firstNew, firstWord));
  let at =
    b.props.viewAt ?? (Number.isFinite(land) ? land - b.props.viewDur : 0);
  if (at < 0 && b.props.viewAt == null) {
    // Leave once the outgoing line has been said (its drawings may finish on the move);
    // with little room, travel faster (down to 0.8 s) rather than land late.
    const aDur = a.frames / fps,
      lastWord = Math.max(0, ...(a.words ?? []).map((w) => w.end));
    const room = adjacent
      ? Math.max(0, Math.min(1.2, aDur - lastWord - 0.1, aDur / 2))
      : 0;
    if (room < -at)
      b.props.viewDur = Math.max(0.8, Math.min(b.props.viewDur, land + room));
    at = Math.max(land - b.props.viewDur, -room);
  }

  return at;
}
