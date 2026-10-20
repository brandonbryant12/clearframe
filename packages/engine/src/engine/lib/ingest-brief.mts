// The evidence brief an author reads instead of the whole report.
import type {
  Research,
  ResearchOutline,
  ResearchTable,
} from './ingest-research.mjs';

const src = (ids: string[]): string =>
  ids.length ? ids.map((i) => `[${i}]`).join(' ') : '⚠ unsourced';
const esc = (s: unknown): string => String(s).replace(/\|/g, '\\|');
const clip = (s: string, max: number, keep: number): string =>
  s.length > max ? s.slice(0, keep) + '…' : s;

const ADVICE = [
  "## Build a film, not the report's outline",
  '',
  '- Name the one question this report answers and the most surprising answer. That tension is the spine; the section order is not.',
  '- Choose 3–5 claims that carry the answer. Give each a different picture: a chart, a drawn mechanism (`canvas`), a plate, a stat on a colour block, poster type.',
  '- Where the report describes a process, a chain of causes or a place, draw it once as a `world` and let the camera travel between its stops instead of cutting to a new slide.',
  '- Give type a voice (`textMotion`: words for editorial, cascade for a hook) and keep held frames alive (loops, `particles`, a slow camera).',
  '- Open with the strongest figure or contradiction (below), not with context. Close on what it means for the viewer.',
  '- Show only figures with a source; mark estimates as estimates. ⚠ marks figures the report does not attribute.',
  '',
];

function figureRows(r: Research): string[] {
  const sourced = r.figures.filter((f) => f.sources.length),
    unsourced = r.figures.filter((f) => !f.sources.length);
  const out = [
    '## Figures',
    '',
    '| # | Figure | Claim | Section | Source |',
    '|---|---|---|---|---|',
  ];
  [...sourced, ...unsourced]
    .slice(0, 60)
    .forEach((f, i) =>
      out.push(
        `| ${i + 1} | **${esc(f.figure)}** | ${esc(clip(f.sentence, 220, 217))} | ${esc(f.section)} | ${src(f.sources)} |`,
      ),
    );
  if (r.figures.length > 60)
    out.push('', `…${r.figures.length - 60} more in research.json.`);
  return out;
}

const tableLine = (t: ResearchTable, i: number): string =>
  `${i + 1}. ${t.section}: ${t.headers.join(' · ')} (${t.rows.length} rows; numeric columns: ${t.headers.filter((_, j) => t.numeric[j]).join(', ') || 'none'})`;

function listings(r: Research): string[] {
  const out: string[] = [];
  if (r.contrasts.length)
    out.push(
      '',
      '## Tensions and turns',
      '',
      ...r.contrasts
        .slice(0, 20)
        .map((c) =>
          `- ${c.sentence} ${c.sources.length ? src(c.sources) : ''}`.trimEnd(),
        ),
    );
  if (r.questions.length)
    out.push(
      '',
      '## Questions the report raises',
      '',
      ...r.questions.slice(0, 12).map((q) => `- ${q.sentence}`),
    );
  if (r.quotes.length)
    out.push(
      '',
      '## Quotations',
      '',
      ...r.quotes.slice(0, 12).map((q) => `- “${q.text}” (${q.section})`),
    );
  if (r.tables.length)
    out.push(
      '',
      '## Tables (chart candidates)',
      '',
      ...r.tables.slice(0, 8).map(tableLine),
    );
  return out;
}

const sectionLine = (s: ResearchOutline): string =>
  `- ${'  '.repeat(Math.max(0, s.level - 2))}**${s.heading}** (${s.figures} figures) ${s.lead ? '— ' + clip(s.lead, 160, 157) : ''}`;

/** The evidence brief an author reads instead of the whole report. */
export function briefMarkdown(r: Research, file: string): string {
  const out = [
    `# ${r.title}`,
    '',
    `Evidence brief generated from \`${file}\` (${r.words.toLocaleString('en-US')} words, ${r.sections.length} sections, ${r.figures.length} figures, ${r.sources.length} sources). Figures and sentences are quoted from the report; verify each against its source before publishing.`,
    '',
    ...ADVICE,
    ...figureRows(r),
    ...listings(r),
    '',
    '## Sections',
    '',
    ...r.sections.map(sectionLine),
    '',
    '## Sources',
    '',
    ...r.sources.map(
      (s) => `- [${s.id}] ${s.title}${s.url ? ` — ${s.url}` : ''}`,
    ),
  ];
  return out.join('\n') + '\n';
}
