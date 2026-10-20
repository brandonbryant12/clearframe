import type { ResearchFigure } from './contracts.mjs';

// Capitalised words that lead into a quantity rather than name a thing ("About 3.2M").
export const NAMED = new Set(
  'About Around Nearly Almost Over Under Some Only Just More Less Fewer At In By The A An Of Up Down To From Roughly Approximately Exactly Top Bottom First Last'.split(
    ' ',
  ),
);

export const MONTH_PREFIXES = new Set([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]);

// A figure: optional currency, a number, an optional range or "of N", and an optional unit.
export const NUM = String.raw`[$€£¥]?\s?[-−]?\d[\d,]*(?:\.\d+)?`;

export const UNIT = String.raw`%|°\s?[CF]|°|percentage points?|percent|per cent|pp|×|x|times|fold|k|K|M|B|bn|million|billion|trillion|thousand|hundred|kg|tonnes?|km|mph|km\/h|[kMGT]Wh?|ppm|hours?|days?|weeks?|months?|years?|minutes?|seconds?|people|users|households`;

export const FIGURE = new RegExp(
  String.raw`${NUM}(?:\s?[–-]\s?${NUM})?(?:\s(?:of|in|out of)\s(?:every\s)?\d[\d,]*)?(?:\s?(?:${UNIT})(?![a-z]))?`,
  'gi',
);

export const blank = (m: string): string => ' '.repeat(m.length);

// Dates, versions, codes and colours are not statistics: blank them before matching.
export function scrub(sentence: string): string {
  return (
    sentence
      .replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g, blank)
      .replace(
        /\b([A-Z][a-z]*)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b(?:,?\s+\d{4})?/g,
        (match: string, month: string) =>
          MONTH_PREFIXES.has(month.slice(0, 3)) ? blank(match) : match,
      )
      .replace(/#[0-9a-f]{3,8}\b/gi, blank)
      .replace(/(?<=[A-Za-z])\d[\d.]*/g, blank)
      // "Opus 5.5", "Route 12", "Figure 3": a name's number, not a measurement.
      .replace(
        /(\b[A-Z][\w-]*\s)(\d+(?:\.\d+)?)(?![\d.,]|\s?(?:%|×|[kKMB]\b))/g,
        (m: string, name: string, num: string) =>
          NAMED.has(name.trim()) ? m : name + ' '.repeat(num.length),
      )
  );
}

export type FigureValue = Pick<ResearchFigure, 'figure' | 'value' | 'unit'>;

export function figureAt(
  m: RegExpMatchArray,
  scrubbed: string,
): FigureValue | null {
  const token = m[0].trim().replace(/,$/, '');
  const index = m.index ?? 0;
  // A number in a series ("8 → 34 → 61") is a figure even when it is small.
  const series =
    /(?:→|->)\s*$/.test(scrubbed.slice(0, index)) ||
    /^\s*(?:→|->)/.test(scrubbed.slice(index + m[0].length));
  const n = Number(
    (token.match(/[-−]?\d[\d,]*(?:\.\d+)?/)?.[0] ?? '')
      .replace(/,/g, '')
      .replace('−', '-'),
  );
  if (!Number.isFinite(n) || !/\d/.test(token)) return null;
  const unit = token
    .replace(/^[$€£¥]?\s?[-−]?[\d,.]+/, '')
    .replace(/^\s?[–-]\s?[$€£¥]?[\d,.]+/, '')
    .replace(/^\s(?:of|in|out of)\s(?:every\s)?[\d,]+/, '')
    .replace(/^\s?/, '');
  const bare =
    !unit &&
    !/[$€£¥]/.test(token) &&
    !/\s(?:of|in|out of)\s/.test(token) &&
    !/[–-]/.test(token);
  const year = bare && /^(1[89]|20|21)\d\d$/.test(token);
  // A lone small integer ("step 2", "3 reasons") is rarely a statistic worth showing.
  if (year || (bare && !series && Math.abs(n) < 10 && /^\d$/.test(token)))
    return null;
  return {
    figure: token,
    value: n,
    unit: unit || (token.match(/^[$€£¥]/)?.[0] ?? ''),
  };
}

export function sentenceFigures(
  sentence: string,
  section: string,
  sources: string[],
): ResearchFigure[] {
  // A brief's own header ("For: 4,200 employees", "Length: 90 seconds, 16:9") describes the film,
  // not the facts in it: EVIDENCE.md listed those as unsourced figures to put on screen.
  if (
    /^(from|for|length|format|audience|after watching they should)\s*:/i.test(
      sentence,
    )
  )
    return [];
  const scrubbed = scrub(sentence);
  const out: ResearchFigure[] = [];
  for (const m of scrubbed.matchAll(FIGURE)) {
    const figure = figureAt(m, scrubbed);
    if (figure) out.push({ ...figure, sentence, section, sources });
  }
  return out;
}

// One entry per distinct figure-in-sentence; prefer sourced ones first, keep document order.
export function uniqueFigures(figures: ResearchFigure[]): ResearchFigure[] {
  const seen = new Set<string>();
  return figures.filter((f) => {
    const k = f.figure + f.sentence;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
