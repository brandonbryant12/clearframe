import type {
  ResearchFigure,
  ResearchContrast,
  ResearchQuestion,
  ResearchOutline,
  ResearchQuote,
  ParsedSection,
  TableDraft,
} from './contracts.mjs';
import { sentencesOf, plain } from './markdown.mjs';
import { sourceLine } from './sources.mjs';
import { sentenceFigures } from './figures.mjs';

export const contrastWords =
  /\b(however|but|although|though|despite|yet|whereas|instead|contrary|paradox|nevertheless)\b/i;

export const contrastPhrases =
  /\b(in contrast|surprising(?:ly)?|unexpected(?:ly)?|counter-?intuitive|even though)\b/i;

export const isContrast = (sentence: string): boolean =>
  contrastWords.test(sentence) || contrastPhrases.test(sentence);

/** The second pass: each body sentence's figures, tensions, questions and quotations. */
export class EvidencePass {
  words = 0;
  readonly figures: ResearchFigure[] = [];
  readonly contrasts: ResearchContrast[] = [];
  readonly questions: ResearchQuestion[] = [];
  readonly outline: ResearchOutline[] = [];
  private readonly quotes: ResearchQuote[];
  private readonly sourceFor: (md: string) => string[];

  constructor(quotes: ResearchQuote[], sourceFor: (md: string) => string[]) {
    this.quotes = quotes;
    this.sourceFor = sourceFor;
  }

  section(s: ParsedSection): void {
    let first: string | null = null,
      count = 0;
    for (const p of s.paragraphs) {
      const shared = [
        ...new Set(sentencesOf(p).filter(sourceLine).flatMap(this.sourceFor)),
      ];
      // Split the markdown paragraph and its plain form in step so citations stay attached.
      for (const md of sentencesOf(p)) {
        const read = this.sentence(md, s.heading, shared);
        if (!read) continue;
        first ??= read.text;
        count += read.figures;
      }
    }
    this.outline.push({
      heading: s.heading,
      level: s.level,
      lead: first,
      figures: count,
    });
  }

  private sentence(
    md: string,
    heading: string,
    shared: string[],
  ): { text: string; figures: number } | null {
    const sentence = plain(md)
      .replace(/\s*\[[\w.,\s-]+\]/g, '')
      .trim();
    if (!sentence) return null;
    this.words += sentence.split(/\s+/).length;
    const own = this.sourceFor(md),
      cites = own.length ? own : shared;
    const found = sentenceFigures(sentence, heading, cites);
    this.figures.push(...found);
    if (isContrast(sentence) && sentence.length < 280)
      this.contrasts.push({ sentence, section: heading, sources: cites });
    if (/\?$/.test(sentence))
      this.questions.push({ sentence, section: heading });
    for (const q of sentence.matchAll(/[“"]([^”"]{30,240})[”"]/g))
      this.quotes.push({ text: q[1], section: heading });
    return { text: sentence, figures: found.length };
  }
}

export const numericColumns = (t: TableDraft): boolean[] =>
  t.headers.map(
    (_, i) =>
      t.rows.length > 1 &&
      t.rows.every((r) =>
        /^[$€£¥]?[-−]?[\d,.]+\s?%?[a-z×]*$/i.test(r[i] ?? ''),
      ),
  );
