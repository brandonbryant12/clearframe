import type { Research } from './contracts.mjs';
import { ReportScan } from './scan.mjs';
import { linkSources, sourcesCited } from './sources.mjs';
import { EvidencePass, numericColumns } from './evidence.mjs';
import { uniqueFigures } from './figures.mjs';

/** Parse a research report into sections, figures, tensions, questions, quotes, tables and sources. */
export function parseResearch(markdown: string): Research {
  let text = markdown.replace(/\r\n?/g, '\n');
  let title: string | null = null;
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (front) {
    title = front[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? null;
    text = text.slice(front[0].length);
  }
  const scan = new ReportScan(title);
  for (const raw of text.split('\n')) scan.line(raw);
  scan.finish();
  const body = scan.sections.filter((s) => !s.references);
  linkSources(body, scan.sources);
  const evidence = new EvidencePass(scan.quotes, sourcesCited(scan.sources));
  for (const s of body) evidence.section(s);
  return {
    title: scan.title ?? 'Untitled report',
    words: evidence.words,
    sections: evidence.outline,
    figures: uniqueFigures(evidence.figures),
    contrasts: evidence.contrasts,
    questions: evidence.questions,
    quotes: scan.quotes,
    tables: scan.tables.map((t) => ({ ...t, numeric: numericColumns(t) })),
    sources: [...scan.sources.values()],
  };
}
