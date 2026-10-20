import type { Spoken, SpokenFigure, ChartSuggestion } from './contracts.mjs';

export const NUMBER_WORDS = new Set(
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion and point'.split(
    ' ',
  ),
);

export const clean = (t: string): string =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9.$%-]/g, '')
    .replace(/[.]+$/, '');

export const isNum = (t: string): boolean =>
  /\d/.test(t) ||
  t
    .split('-')
    .every((p) => NUMBER_WORDS.has(p) && p !== 'and' && p !== 'point');

/** The figure a number phrase says, or null for a small count said alone. */
export function phraseFigure(
  word: string,
  phrase: string[],
  after: string,
  spoken: Spoken,
): SpokenFigure | null {
  const said = spoken(phrase.map(clean)).split(/\s+/)[0] ?? '';
  const value = Number(said.replace(/[$,%]/g, ''));
  const text = phrase.join(' ');
  const smallCount =
    value <= 10 &&
    Number.isInteger(value) &&
    !/[$%]/.test(text + after) &&
    !/^(percent|dollars?|points?)$/.test(after);
  if (!Number.isFinite(value) || smallCount) return null;
  return {
    value,
    say: word.replace(/[^\p{L}\p{N}$%.-]/gu, '').replace(/[.]$/, ''),
    prefix: /\$/.test(text) || /^dollars?$/.test(after) ? '$' : '',
    suffix: /%/.test(text) || after === 'percent' ? '%' : '',
  };
}

/**
 * The figures a line says, in order, each with the word it starts on (for a value's `say`):
 * "starts at forty dollars, goes to fifty, you pay thirty-four" → 40, 50, 34. Small counts
 * (one to ten, said alone) are left out: they are usually not figures.
 */
export function figuresIn(vo: unknown, spoken: Spoken): SpokenFigure[] {
  const tokens = String(vo).split(/\s+/).filter(Boolean),
    out: SpokenFigure[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const first = clean(tokens[i]);
    if (!first || !isNum(first)) continue;
    let j = i + 1;
    while (
      j < tokens.length &&
      (isNum(clean(tokens[j])) || /^(and|point)$/.test(clean(tokens[j])))
    )
      j++;
    const figure = phraseFigure(
      tokens[i],
      tokens.slice(i, j),
      clean(tokens[j] ?? ''),
      spoken,
    );
    if (figure) out.push(figure);
    i = j - 1;
  }
  scaleRanges(out, vo);
  return out;
}

/** A canvas beat's chart for a line's figures, ready to paste: one figure is a number, several are bars. */
export function chartFor(vo: unknown, spoken: Spoken): ChartSuggestion | null {
  const f = figuresIn(vo, spoken).slice(0, 6);
  if (!f.length) return null;
  // One currency or percent sign said once ("forty dollars, fifty, thirty-four") covers the set.
  const prefix =
      f.some((x) => x.prefix === '$') && !f.some((x) => x.suffix) ? '$' : '',
    suffix =
      f.some((x) => x.suffix === '%') && !f.some((x) => x.prefix) ? '%' : '';
  return {
    kind: f.length === 1 ? 'number' : 'bars',
    ...(prefix ? { prefix } : {}),
    ...(suffix ? { suffix } : {}),
    values: f.map((x, i) => ({
      label: `WHAT ${i + 1} IS`,
      value: x.value,
      say: x.say,
    })),
  };
}

export function scaleRanges(out: SpokenFigure[], vo: unknown): void {
  // A range said once with its scale ("twelve to eighteen thousand dollars") scales both ends.
  for (let k = 0; k + 1 < out.length; k++) {
    const a = out[k],
      b = out[k + 1];
    if (
      b.value >= 1000 &&
      a.value < 1000 &&
      a.value * 1000 <= b.value * 2 &&
      new RegExp(`\\b${a.say}\\s+(to|or|and)\\s+${b.say}`, 'i').test(String(vo))
    )
      a.value *= b.value >= 1e6 && a.value * 1e6 <= b.value * 2 ? 1e6 : 1000;
  }
}
