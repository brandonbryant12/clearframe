import fs from 'node:fs';
import path from 'node:path';

import { documentMarkdown, parseResearch, briefMarkdown } from '../ingest.mjs';
import { writeJSON } from '../util.mjs';
import { copyInput } from '../brand.mjs';
import type { Research } from '../ingest.mjs';
import type { Brand } from '../brand.mjs';

import type { StartInput, Tagged, CombinedResearch } from './contracts.mjs';
import { picturesFor } from './pictures.mjs';

export interface StagedDocument {
  id: string;
  base: string;
  rel: string;
  stagedInput: string;
  source: string;
  research: Research;
}

export function documentList(document: unknown): unknown[] {
  if (document == null) return [];
  return Array.isArray(document) ? document : [document];
}

// Parse the exact copy named by the receipt, even if the external file changes later.
export function stageDocuments(
  documents: string[],
  staging: string,
  inputs: StartInput[],
): StagedDocument[] {
  return documents.map((file, i) => {
    const sourceFile = path.resolve(file),
      id = `doc${i + 1}`;
    const base = documents.length === 1 ? 'source' : `source/documents/${id}`;
    const rel = `${base}/original${path.extname(sourceFile).toLowerCase()}`;
    const stagedInput = path.join(staging, rel);
    const copied = copyInput(sourceFile, stagedInput);
    inputs.push({
      ...(documents.length > 1 ? { id } : {}),
      file: rel,
      name: path.basename(sourceFile),
      ...copied,
    });
    const source = documentMarkdown(stagedInput),
      research = parseResearch(source);
    return { id, base, rel, stagedInput, source, research };
  });
}

export const tag = <T extends object>(
  d: StagedDocument,
  entries: T[],
): Tagged<T>[] => entries.map((entry) => ({ ...entry, document: d.id }));

export const tagCited = <T extends { sources: string[] }>(
  d: StagedDocument,
  entries: T[],
): Tagged<T>[] =>
  entries.map((entry) => ({
    ...entry,
    document: d.id,
    sources: entry.sources.map((id) => `${d.id}:${id}`),
  }));

/** Several documents' evidence as one, every entry tagged with its document and sources prefixed by it. */
export function combineResearch(collected: StagedDocument[]): CombinedResearch {
  return {
    title: collected[0].research.title,
    words: collected.reduce((n, d) => n + d.research.words, 0),
    documents: collected.map((d) => ({
      id: d.id,
      file: d.rel,
      title: d.research.title,
    })),
    sections: collected.flatMap((d) => tag(d, d.research.sections)),
    figures: collected.flatMap((d) => tagCited(d, d.research.figures)),
    contrasts: collected.flatMap((d) => tagCited(d, d.research.contrasts)),
    questions: collected.flatMap((d) => tag(d, d.research.questions)),
    quotes: collected.flatMap((d) => tag(d, d.research.quotes)),
    tables: collected.flatMap((d) => tag(d, d.research.tables)),
    sources: collected.flatMap((d) =>
      d.research.sources.map((entry) => ({
        ...entry,
        document: d.id,
        id: `${d.id}:${entry.id}`,
      })),
    ),
  };
}

export function researchOf(
  collected: StagedDocument[],
): Research | CombinedResearch | null {
  if (collected.length === 1) return collected[0].research;
  return collected.length ? combineResearch(collected) : null;
}

// Keep sample attribution on the starter's illustrative figures. The report's sources
// live in its evidence brief until an author binds real claims to rewritten beats.
export function writeEvidence(
  project: string,
  collected: StagedDocument[],
  research: Research | CombinedResearch,
  inputs: StartInput[],
): void {
  for (const d of collected) {
    fs.mkdirSync(path.join(project, d.base), { recursive: true });
    fs.renameSync(d.stagedInput, path.join(project, d.rel));
    fs.writeFileSync(path.join(project, d.base, 'document.md'), d.source);
    writeJSON(path.join(project, d.base, 'research.json'), d.research);
  }
  writeJSON(path.join(project, 'source/research.json'), research);
  const heading = (d: StagedDocument): string =>
    collected.length > 1
      ? `# Document ${d.id}: ${inputs.find((i) => i.id === d.id)?.name}\n\nCitations in this section belong only to ${d.rel}. Aggregated research IDs use ${d.id}: prefixes.\n\n`
      : '';
  fs.writeFileSync(
    path.join(project, 'EVIDENCE.md'),
    collected
      .map((d) => heading(d) + briefMarkdown(d.research, d.rel))
      .join('\n---\n\n'),
  );
}

export interface BriefContext {
  title: string;
  idea?: string;
  audience?: string;
  takeaway?: string;
  brand: Brand | null;
  research: Research | null;
  collected: StagedDocument[];
}

export function writeBrief(project: string, c: BriefContext): void {
  const brief = fs.readFileSync(path.join(project, 'BRIEF.md'), 'utf8');
  fs.writeFileSync(
    path.join(project, 'BRIEF.md'),
    `# Production brief: ${c.title}\n\n` +
      `Idea: ${c.idea?.trim() ?? 'Develop the question and turn from EVIDENCE.md.'}\nAudience: ${c.audience ?? 'To be decided'}\nTakeaway: ${c.takeaway ?? 'To be decided'}\n` +
      `${c.brand ? '\nBrand: BRAND.md (assets and rules).\n' : ''}${c.research ? '\nEvidence: EVIDENCE.md and source/research.json.\n' : ''}\n` +
      picturesFor(c.collected.map((d) => d.source).join('\n')) +
      `## Starter arc\n${brief.replace(/^# .*\n/, '')}\n## Next pass\n` +
      `1. Choose the question, tension, turn and payoff in DIRECTION.md.\n2. Rewrite the sample beats around the source. Bind every figure to its visible source.\n3. Place the supplied assets where they support the story.\n4. Run critique, then draft; review the complete film before polishing individual shots.\n`,
  );
  fs.appendFileSync(
    path.join(project, 'DIRECTION.md'),
    `\n## Intake\nRead BRIEF.md${c.research ? ', EVIDENCE.md' : ''}${c.brand ? ' and BRAND.md' : ''}. ` +
      `The storyboard is still an illustrative starting arc. Keep factual claims tied to the supplied material.\n` +
      `Audience: ${c.audience ?? 'To be decided'}\nTakeaway: ${c.takeaway ?? 'To be decided'}\n`,
  );
}
