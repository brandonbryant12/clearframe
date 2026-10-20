// What a "keep facts" protects: the information a beat shows and the sources it cites.
import { fingerprint } from './store.mjs';
import { isRecord } from './errors.mjs';
import type { Beat, Source } from '../domain.mjs';

export type Fact = [string, string | number];

// What a "keep facts" protects: everything a beat shows as information (figures, category
// labels, units and formats, qualifiers, titles, scale limits, attribution) and the sources it
// cites. Excluded, by key, is only what places, styles, times or identifies things, plus
// purely decorative elements. Relevance is never inferred from the presence of digits.
const NOT_FACT = new Set(
  `x y w h r cx cy rx ry x1 y1 x2 y2 size width height points d box view viewFrom viewAt viewDur viewDrift viewTall
   viewNext depth z rotate origin tilt fit leading tracking stagger dash arrow head anchor align columns cols orientation
   layout gap padding radius minScale maxScale offset closed spin perspective shade marks arcs bars step
   fill stroke color opacity blend cap join font upper material glow shadow blur rough mosaic echo shine treatment side
   drift emphasisStyle mode preset ease tone emphasis highlight phrases sort dim style kind shape
   at dur dist say exitSay land growSay drawSay enter exit exitAt exitDur keys loop along morphDur fps period speed seed
   maxWords maxGap maxDuration intensity amount dolly focus
   id type asset file sketch world plates subject behind icon name carried note`
    .split(/\s+/)
    .filter(Boolean),
);
const DECORATIVE = new Set(['particles', 'solid', 'spotlight', 'meter']);

export function factsOf(value: unknown, key = ''): Fact[] {
  if (value == null || typeof value === 'boolean') return [];
  if (typeof value === 'number' || typeof value === 'string')
    return NOT_FACT.has(key) ? [] : [[key, value]];
  if (Array.isArray(value))
    return value.flatMap((v: unknown) => factsOf(v, key));
  if (isRecord(value)) {
    if (typeof value.type === 'string' && DECORATIVE.has(value.type)) return [];
    // A canvas element's `note` is an author's comment; a chart's `note` is shown on screen.
    return Object.keys(value)
      .sort()
      .flatMap((k) =>
        NOT_FACT.has(k) &&
        !(k === 'note' && value[k] && typeof value[k] === 'object')
          ? []
          : factsOf(value[k], k),
      );
  }
  return [];
}

/** A beat's facts as one fingerprint: what it shows as information, and the sources it cites. */
export const factsPrint = (
  beat: Partial<Beat>,
  sources: Source[] = [],
): string =>
  fingerprint({
    shown: factsOf({ props: beat.props, art: beat.art }),
    sources: citedSources(beat, sources),
  });

const esc = (s: unknown): string =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The film's source entries a beat's attribution names (by title, id or URL). */
export function citedSources(
  beat: Partial<Beat>,
  sources: Source[] = [],
): Source[] {
  const chart = beat.props?.chart;
  const said = [beat.props?.source, isRecord(chart) ? chart.source : undefined]
    .filter((s): s is string => typeof s === 'string')
    .join(' ')
    .toLowerCase();
  if (!said.trim()) return [];
  return sources.filter(
    (s) =>
      (s.title && said.includes(String(s.title).toLowerCase())) ||
      (s.url && said.includes(String(s.url).toLowerCase())) ||
      (s.id &&
        new RegExp(
          `(^|[^\\w])${esc(String(s.id).toLowerCase())}($|[^\\w])`,
        ).test(said)),
  );
}
