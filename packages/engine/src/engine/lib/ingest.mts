// Turn source material into raw material for a film: a research report into an evidence
// brief, a long recording into narrated beats on its own measured clock.
import fs from 'node:fs';
import path from 'node:path';
import { writeJSON } from './util.mjs';
import { parseResearch } from './ingest-research.mjs';
import { briefMarkdown } from './ingest-brief.mjs';
import { documentMarkdown } from './ingest-documents.mjs';
import type { Research, ResearchFigure } from './ingest-research.mjs';
import type { Storyboard } from '../domain.mjs';

export { parseResearch } from './ingest-research.mjs';
export type {
  Research,
  ResearchSource,
  ResearchFigure,
  ResearchContrast,
  ResearchQuestion,
  ResearchQuote,
  ResearchTable,
  ResearchOutline,
} from './ingest-research.mjs';
export { briefMarkdown } from './ingest-brief.mjs';
export { htmlToMarkdown, documentMarkdown } from './ingest-documents.mjs';
export {
  timedWords,
  scriptTurns,
  scriptTokens,
  scriptedWords,
  segmentWords,
  cutPoints,
} from './ingest-words.mjs';
export type {
  TranscriptWord,
  Turn,
  ScriptToken,
  ScriptedWords,
  SegmentOptions,
} from './ingest-words.mjs';
export { ingestRecording } from './ingest-recording.mjs';
export type {
  RecordingOptions,
  RecordingRequest,
  RecordingReceipt,
  SpeakerOverride,
} from './ingest-recording.mjs';

export interface MarkdownIngestOptions {
  scaffold?: (playbook: string, options: { title: string }) => Storyboard;
  playbook?: string;
}
export interface MarkdownIngestSummary {
  title: string;
  figures: number;
  sourced: number;
  contrasts: number;
  tables: number;
  sources: number;
}

// Start the direction from the evidence, not a blank page: the questions, the tensions and
// the sourced figures the brief found. The storyboard is the playbook's sample to rewrite.
function directionFromBrief(r: Research): string {
  const cite = (f: ResearchFigure): string =>
    f.sources.length
      ? ` [${f.sources.join(', ')}]`
      : ' (unsourced: confirm or cut)';
  const lines = [
    '',
    `## From the brief (${r.title})`,
    '',
    'The storyboard is the playbook’s sample, written for another subject: replace every beat with this material.',
    '',
    ...(r.questions.length
      ? [
          'Questions the report asks:',
          ...r.questions.slice(0, 3).map((q) => `- ${q.sentence}`),
          '',
        ]
      : []),
    ...(r.contrasts.length
      ? [
          'Tensions (a turn lives here):',
          ...r.contrasts.slice(0, 3).map((c) => `- ${c.sentence}`),
          '',
        ]
      : []),
    'Figures, sourced first:',
    ...[...r.figures]
      .sort((a, b) => b.sources.length - a.sources.length)
      .slice(0, 6)
      .map((f) => `- ${f.figure}: ${f.sentence}${cite(f)}`),
    ...(r.quotes.length
      ? ['', 'Quotations:', ...r.quotes.slice(0, 2).map((q) => `- “${q.text}”`)]
      : []),
    '',
  ];
  return lines.join('\n');
}

function scaffoldFromBrief(
  root: string,
  r: Research,
  scaffold: NonNullable<MarkdownIngestOptions['scaffold']>,
  playbook: string,
): void {
  const sb = scaffold(playbook, { title: r.title });
  if (r.sources.length)
    sb.sources = r.sources.map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.url ? { url: s.url } : {}),
    }));
  writeJSON(path.join(root, 'storyboard.json'), sb);
  const direction = path.join(root, 'DIRECTION.md');
  if (fs.existsSync(direction))
    fs.appendFileSync(direction, directionFromBrief(r));
}

export function ingestMarkdown(
  root: string,
  file: string,
  { scaffold, playbook = 'research-digest' }: MarkdownIngestOptions = {},
): MarkdownIngestSummary {
  const source = documentMarkdown(file);
  const r = parseResearch(source);
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, 'source');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(file, path.join(dir, path.basename(file)));
  if (!/\.(md|markdown)$/i.test(file))
    fs.writeFileSync(
      path.join(dir, `${path.basename(file).replace(/\.[^.]+$/, '')}.md`),
      source,
    );
  writeJSON(path.join(dir, 'research.json'), r);
  fs.writeFileSync(
    path.join(root, 'BRIEF.md'),
    briefMarkdown(r, `source/${path.basename(file)}`),
  );
  if (scaffold && !fs.existsSync(path.join(root, 'storyboard.json')))
    scaffoldFromBrief(root, r, scaffold, playbook);
  return {
    title: r.title,
    figures: r.figures.length,
    sourced: r.figures.filter((f) => f.sources.length).length,
    contrasts: r.contrasts.length,
    tables: r.tables.length,
    sources: r.sources.length,
  };
}
