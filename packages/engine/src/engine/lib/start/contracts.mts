import type { Research, ResearchContrast, ResearchFigure } from '../ingest.mjs';
import type { BrandInventoryEntry, CopiedInput } from '../brand.mjs';

/** CLI or studio options; text fields are checked here, the rest pass to the playbook scaffold. */
export type StartOptions = Readonly<Record<string, unknown>>;

export interface StartInput extends CopiedInput {
  id?: string;
  file: string;
  name: string;
}

export type Tagged<T> = T & { document: string };

export interface CombinedResearch extends Research {
  documents: { id: string; file: string; title: string }[];
  sections: Tagged<Research['sections'][number]>[];
  figures: Tagged<ResearchFigure>[];
  contrasts: Tagged<ResearchContrast>[];
  questions: Tagged<Research['questions'][number]>[];
  quotes: Tagged<Research['quotes'][number]>[];
  tables: Tagged<Research['tables'][number]>[];
  sources: Tagged<Research['sources'][number]>[];
}

export interface StartReceipt {
  version: 1;
  status: 'starter-needs-direction';
  title: string;
  idea: string | null;
  audience: string | null;
  takeaway: string | null;
  inputs: StartInput[];
  assets: BrandInventoryEntry[];
  evidence: {
    figures: number;
    sourced: number;
    sources: number;
    tables: number;
  } | null;
  next: string[];
}
