import type { JobBeat, CanvasElement } from './types.mjs';

export function carryWorld(a: JobBeat, b: JobBeat, fps: number): void {
  const shift = (b.start_frame - a.start_frame) / fps;
  const carried: CanvasElement[] = [],
    own: CanvasElement[] = [];
  for (const el of a.props.elements ?? [])
    (el.carried ? carried : own).push(el);
  const group = (
    children: CanvasElement[],
    behind: boolean,
  ): CanvasElement => ({
    type: 'group',
    carried: true,
    behind,
    at: 0,
    dur: 0,
    enter: 'none',
    shift,
    children,
  });
  const moved = (g: CanvasElement): CanvasElement => ({
    ...g,
    shift: (g.shift ?? 0) + shift,
  });
  const layer = (behind: boolean): CanvasElement[] => [
    ...carried.filter((g) => !!g.behind === behind).map(moved),
    ...(own.some((el) => !!el.behind === behind)
      ? [
          group(
            own.filter((el) => !!el.behind === behind),
            behind,
          ),
        ]
      : []),
  ];
  // `behind` elements (a sky changing colour, a glow under the city) stay under the world,
  // newest above older ones; everything else draws over what came before.
  const mine = b.props.elements ?? [];
  b.props.elements = [
    ...layer(true),
    ...mine.filter((el) => el.behind),
    ...layer(false),
    ...mine.filter((el) => !el.behind),
  ];
}
/**
 * What of a list of drawn elements stands from its first frame, as a still copy: elements with no
 * entrance at 0 (and groups that open at 0, such as a placed panel), their first-frame keys only,
 * without ids (ids pair shapes across cuts for morphs) or exits.
 */
export function groundOf(list: CanvasElement[] | undefined): CanvasElement[] {
  const out = [];
  for (const el of list ?? []) {
    const opens =
      (el.at ?? 0) <= 0.05 &&
      (el.enter === 'none' || (el.type === 'group' && (el.at ?? 0) <= 0.05));
    if (!opens || (el.exitAt != null && el.exitAt <= 0.05)) continue;
    const {
      id: _id,
      keys,
      exitAt: _exitAt,
      exitSay: _exitSay,
      exit: _exit,
      exitDur: _exitDur,
      children,
      enter: _enter,
      dur: _dur,
      ...rest
    } = el;
    const first = (keys ?? []).filter(
      (k) => (k.at ?? 0) <= 0 && (k.dur ?? 0) === 0,
    );
    const copy: CanvasElement = {
      ...rest,
      at: 0,
      enter: 'none',
      ...(first.length ? { keys: first } : {}),
    };
    if (el.type === 'group') {
      copy.children = groundOf(children);
      if (!copy.children.length) continue;
    }
    out.push(copy);
  }
  return out;
}
