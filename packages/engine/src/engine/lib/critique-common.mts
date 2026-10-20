import type { Storyboard } from '../domain.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';
import { isRecord } from './errors.mjs';

import { rules } from '../../film/registry.mjs';

/**
 * Native stages are drawings: a stage block, a beat's own stage layer, or a film stage spanning
 * beats (whose actors keep their identity across the cuts between them). Each beat learns the film
 * stage it belongs to as `_stage`.
 */
export function withStages(
  sb: Storyboard,
  beats: CritiqueBeat[],
): CritiqueBeat[] {
  const index = new Map(sb.beats.map((b, i) => [b.id, i]));
  for (const st of sb.stages ?? []) {
    const [a, z] = [
      index.get(String(st.from)),
      index.get(String(st.to ?? st.from)),
    ];
    if (a == null || z == null) continue;
    for (let i = a; i <= z; i++)
      beats[i] = {
        ...beats[i],
        _stage: String(st.id),
        _stageFirst: i === a ? st : null,
      };
  }
  return beats;
}
export const staged = (b: CritiqueBeat) =>
  b.block === 'stage' || b.stage != null || b._stage != null;
export const sameStage = (
  a: CritiqueBeat | undefined,
  b: CritiqueBeat | undefined,
) => a?._stage != null && a._stage === b?._stage;
// Consecutive cast beats are one continuous picture: the same objects carry across the cut.
export const sameCast = (
  a: CritiqueBeat | undefined,
  b: CritiqueBeat | undefined,
) => Boolean(a?._cast && b?._cast);
// A canvas that holds only type is a type card (poster type), not a drawing.
export const typeCard = (b: CritiqueBeat) =>
  b.block === 'canvas' &&
  (b.props?.elements ?? []).length > 0 &&
  (b.props?.elements ?? []).every((el) => el.type === 'text');
export const family = (b: CritiqueBeat) =>
  typeCard(b) ? 'type card' : rules(b.block ?? '').family;
// A shape with the same id in consecutive canvas beats morphs across the cut: a match cut.
// A system diagram's nodes keep their ids too.
export const elementIds = (b: CritiqueBeat | undefined) =>
  [...(b?.props?.elements ?? []).map((el) => el.id), ...diagramIds(b)].filter(
    Boolean,
  );
export const matched = (
  a: CritiqueBeat | undefined,
  b: CritiqueBeat | undefined,
) => {
  if (sameStage(a, b) || sameCast(a, b)) return true;
  const ids = new Set(elementIds(a));
  return elementIds(b).some((id) => ids.has(id));
};
export const CONNECTOR =
  /\b(but|so|therefore|because|which means|that's why|that is why|yet|instead|until|unless|except|however|then again|this means|the result|meanwhile|now)\b/i;
export const GREETING =
  /^(hi|hello|hey|welcome|in this video|today we|today,? we|let's|let us|have you ever)\b/i;
export const FULL_FRAME = (b: CritiqueBeat) =>
  b.plate ||
  (b.tone && b.tone !== 'none') ||
  (b.block === 'canvas' && !b.props?.title) ||
  (b.block === 'stage' && !b.props?.title) ||
  b.block === 'kinetic' ||
  b.props?.align === 'center' ||
  (['title', 'statement', 'endcard', 'chapter', 'highlight', 'quote'].includes(
    b.block ?? '',
  ) &&
    !b.props?.title);

export function diagramIds(b: CritiqueBeat | undefined): string[] {
  const diagram = b?.props?.diagram;
  if (!isRecord(diagram) || !Array.isArray(diagram.nodes)) return [];
  return diagram.nodes
    .filter(isRecord)
    .map((n) => `diagram-node-${String(n.id)}`);
}
