import type { Word } from '../domain.mjs';
import { isRecord } from './errors.mjs';

import type { CritiqueContext } from './critique-contracts.mjs';
import { GREETING } from './critique-common.mjs';

export function checkHook(ctx: CritiqueContext) {
  const { beats, t, add } = ctx;
  // Hook.
  const first = beats[0],
    firstDur = t[0]?.dur ?? 0;
  if (first?.vo && GREETING.test(first.vo.trim()))
    add(
      'warn',
      first.id,
      'Opens with a greeting or preamble. Lead with the claim, number or question; greet later or never.',
    );
  // What matters is when the first idea lands: a cued number or drawing, else the scene's end.
  // Explanation primitives (film/explain.mjs) cue their moves inside the prop: {show|draw|fill|flow: {say|at}}.
  const moves = ['graph', 'accumulate', 'estimate', 'field']
    .flatMap((k) => {
      const value = first?.props?.[k];
      return isRecord(value) ? Object.values(value) : [];
    })
    .filter(isRecord);
  const cues = [
    first?.props?.land,
    ...(first?.props?.elements ?? []).map((el) => el.say),
    ...moves.map((v) => v.say),
  ].filter((c) => typeof c === 'string');
  const words = t[0]?.vo?.words ?? [];
  const landed = cues
    .map((c) =>
      words.find(
        (w) =>
          w.w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') ===
          c
            .toLowerCase()
            .split(/\s+/)[0]
            .replace(/[^\p{L}\p{N}]/gu, ''),
      ),
    )
    .filter((w): w is Word => w != null)
    .map((w) => w.t0 - (t[0]?.start ?? 0));
  // Elements with a timed entrance land at their time.
  const timed = [
    first?.props?.elements ?? [],
    first?.art?.under ?? [],
    first?.art?.over ?? [],
    moves,
  ]
    .flat()
    .map((el) => el.at)
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );
  // A picture already on the first frame (a plate, a world drawn at 0) is the first idea.
  const onFirstFrame =
    first?.plate ||
    first?.props?.plates ||
    [first?.props?.elements ?? [], first?.art?.under ?? []]
      .flat()
      .some((el) => (el.at ?? 1) <= 0.05 && el.type !== 'particles');
  // Speech-following type lands as it is said: its first emphasised word, else just after the voice starts.
  if (first?.block === 'kinetic' && words.length) {
    const norm = (w: unknown) =>
      String(w)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
    const stress = new Set((first.props?.emphasis ?? []).map(String).map(norm));
    const hit = words.find((w) => stress.has(norm(w.w)));
    landed.push((hit ? hit.t1 : words[0].t0 + 1) - (t[0]?.start ?? 0));
  }
  const firstCue = landed.length ? Math.min(...landed) : Infinity;
  const firstTimed = timed.length ? Math.min(...timed) + 0.6 : Infinity;
  const lands = onFirstFrame ? 0 : Math.min(firstCue, firstTimed, firstDur);
  if (lands > 5.5)
    add(
      'warn',
      first.id,
      `The first idea lands ${lands.toFixed(1)} s in. Land it inside 3–5 s.`,
    );
}
