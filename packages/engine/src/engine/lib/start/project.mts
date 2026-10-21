import fs from 'node:fs';
import path from 'node:path';
import { scaffold, artSketches } from '../../../film/playbooks.mjs';
import { vendor, useProject } from '../../../film/library.mjs';

import { writeJSON } from '../util.mjs';
import { readBrand, applyBrand } from '../brand.mjs';

import type { Storyboard } from '../../domain.mjs';
import type { StartOptions, StartReceipt, StartInput } from './contracts.mjs';
import {
  documentList,
  stageDocuments,
  researchOf,
  writeEvidence,
  writeBrief,
} from './evidence.mjs';

export const nonempty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

export const optionalText = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined;

export function checkInputs(options: StartOptions): string[] {
  const documents = documentList(options.document);
  if (documents.some((v) => !nonempty(v)))
    throw new Error('--document must name a file');
  if (!nonempty(options.idea) && !documents.length)
    throw new Error('start needs --idea text, --document file, or both');
  for (const key of ['idea', 'audience', 'takeaway'])
    if (options[key] != null && !nonempty(options[key]))
      throw new Error(`--${key} must not be empty`);
  return documents.filter(nonempty);
}

export function themeOption(
  theme: unknown,
): string | Record<string, string> | undefined {
  if (typeof theme === 'string') return theme;
  if (theme && typeof theme === 'object' && !Array.isArray(theme))
    return Object.fromEntries(
      Object.entries(theme).map(([key, value]): [string, string] => [
        key,
        String(value),
      ]),
    );
  return undefined;
}

/** Create a new project as a transaction; a failed intake leaves an existing destination intact. */
export function startProject(
  destination: string,
  options: StartOptions = {},
): StartReceipt {
  const documents = checkInputs(options);
  const idea = optionalText(options.idea),
    audience = optionalText(options.audience),
    takeaway = optionalText(options.takeaway);
  const root = path.resolve(destination);
  if (
    fs.existsSync(root) &&
    (!fs.statSync(root).isDirectory() || fs.readdirSync(root).length)
  )
    throw new Error(`${root} is not empty; start creates a new project`);
  useProject(null);
  // Validate brand settings before staging; source parsing uses the staged original.
  const brandFile = optionalText(options.brand);
  const brand = readBrand(brandFile && path.resolve(brandFile));
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const staging = fs.mkdtempSync(
    path.join(path.dirname(root), '.clearframe-start-'),
  );
  try {
    const inputs: StartInput[] = [];
    const collected = stageDocuments(documents, staging, inputs);
    const research = researchOf(collected);
    const title =
      optionalText(options.title) ??
      research?.title ??
      idea?.trim().slice(0, 100) ??
      'Untitled film';
    const project = path.join(staging, 'project');
    const theme = themeOption(options.theme);
    const sb: Storyboard = scaffold(project, {
      ...options,
      title,
      theme: theme ?? brand?.theme,
      playbook:
        optionalText(options.playbook) ??
        defaultPlaybook(options, documents.length),
    });
    const inventory = applyBrand(project, sb, brand, { theme });
    if (research) writeEvidence(project, collected, research, inputs);
    vendor(project, [
      [
        'palettes',
        typeof sb.theme === 'string' ? sb.theme : sb.theme?.base,
      ] as const,
      ['types', sb.type] as const,
      ...artSketches(sb),
    ]);
    writeJSON(path.join(project, 'storyboard.json'), sb);
    writeBrief(project, {
      title,
      idea,
      audience,
      takeaway,
      brand,
      research,
      collected,
    });
    const receipt: StartReceipt = {
      version: 1,
      status: 'starter-needs-direction',
      title,
      idea: idea?.trim() ?? null,
      audience: audience ?? null,
      takeaway: takeaway ?? null,
      inputs,
      assets: inventory,
      evidence: research
        ? {
            figures: research.figures.length,
            sourced: research.figures.filter((f) => f.sources.length).length,
            sources: research.sources.length,
            tables: research.tables.length,
          }
        : null,
      next: [
        'direction',
        'rewrite-sample-beats',
        'place-brand-assets',
        'critique',
        'draft',
        'review',
      ],
    };
    writeJSON(path.join(project, 'intake.json'), receipt);
    // An empty destination may have acquired work since preflight; rmdir refuses it.
    if (fs.existsSync(root)) fs.rmdirSync(root);
    fs.renameSync(project, root);
    return receipt;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    useProject(null);
  }
}

export function defaultPlaybook(
  options: StartOptions,
  documents: number,
): string | undefined {
  if (options.treatment || options.direction) return undefined;
  return documents ? 'research-digest' : 'concept-explainer';
}
