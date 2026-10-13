// Portable intake for an agent-directed film. No generation, guessing of claims, or paid calls.
import { pictureFor } from './pictures.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { scaffold, artSketches } from '../../film/playbooks.mjs';
import { vendor, useProject } from '../../film/library.mjs';
import { documentMarkdown, parseResearch, briefMarkdown } from './ingest.mjs';
import { writeJSON } from './util.mjs';
import { readBrand, copyInput, applyBrand } from './brand.mjs';

const nonempty = v => typeof v === 'string' && v.trim().length > 0;

/** Create a new project as a transaction; a failed intake leaves an existing destination intact. */
/**
 * The document's own lines that name a mechanism or a figure, each with the picture that shows it
 * (engine/lib/pictures.mjs): the first thing an agent reads maps the brief's facts to pictures,
 * instead of leaving it to swap a playbook's sample beats for sentences.
 */
function picturesFor(text) {
  const lines = String(text)
    .split(/\n(?=\s*(?:[-*]|\d+\.)\s)|(?<=[.!?])\s+(?=[A-Z])/)
    .map(x => x.replace(/[*_`#]/g, '').replace(/\s+/g, ' ').replace(/^\s*(?:[-*]|\d+\.)\s*/, '').trim())
    .filter(x => x.length > 20 && x.length < 400 && !/^(brief|from|for|length|tone)\b/i.test(x));
  const seen = new Set(), rows = [];
  for (const line of lines) {
    const fit = pictureFor(line);
    if (!fit || seen.has(line)) continue;
    seen.add(line);
    rows.push(`- "${line.length > 140 ? `${line.slice(0, 139)}…` : line}" → ${fit.sketch ? `the \`${fit.sketch}\` sketch (\`node engine/cli.mjs sketch ${fit.sketch}\`)` : fit.use}`);
  }
  return rows.length
    ? `## Pictures for this document\n\nEach line of the source that names a mechanism or a figure, and the picture that shows it. Give each fact you keep its own beat with that picture; type is for the one line worth repeating.\n\n${rows.slice(0, 14).join('\n')}\n\n`
    : '';
}

export function startProject(destination, options = {}) {
  const { idea, document, brand: brandFile, audience, takeaway } = options;
  const documents = document == null ? [] : (Array.isArray(document) ? document : [document]);
  if (documents.some(v => !nonempty(v))) throw new Error('--document must name a file');
  if (!nonempty(idea) && !documents.length) throw new Error('start needs --idea text, --document file, or both');
  for (const [key, value] of Object.entries({ idea, audience, takeaway }))
    if (value != null && !nonempty(value)) throw new Error(`--${key} must not be empty`);
  const root = path.resolve(destination);
  if (fs.existsSync(root) && (!fs.statSync(root).isDirectory() || fs.readdirSync(root).length))
    throw new Error(`${root} is not empty; start creates a new project`);
  useProject(null);
  // Validate brand settings before staging; source parsing uses the staged original.
  const brand = readBrand(brandFile && path.resolve(brandFile));
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(root), '.clearframe-start-'));
  try {
    // Parse the exact copy named by the receipt, even if the external file changes later.
    const inputs = [];
    const collected = documents.map((file, i) => {
      const sourceFile = path.resolve(file), id = `doc${i + 1}`;
      const base = documents.length === 1 ? 'source' : `source/documents/${id}`;
      const rel = `${base}/original${path.extname(sourceFile).toLowerCase()}`;
      const stagedInput = path.join(staging, rel);
      const copied = copyInput(sourceFile, stagedInput);
      inputs.push({ ...(documents.length > 1 ? { id } : {}), file: rel, name: path.basename(sourceFile), ...copied });
      const source = documentMarkdown(stagedInput), research = parseResearch(source);
      return { id, base, rel, stagedInput, source, research };
    });
    const research = collected.length === 1 ? collected[0].research : collected.length ? {
      title: collected[0].research.title,
      words: collected.reduce((n, d) => n + d.research.words, 0),
      documents: collected.map(d => ({ id: d.id, file: d.rel, title: d.research.title })),
      ...Object.fromEntries(['sections', 'figures', 'contrasts', 'questions', 'quotes', 'tables', 'sources'].map(key => [key,
        collected.flatMap(d => d.research[key].map(entry => ({ ...entry, document: d.id,
          ...(key === 'sources' ? { id: `${d.id}:${entry.id}` } : {}),
          ...(entry.sources ? { sources: entry.sources.map(id => `${d.id}:${id}`) } : {}) }))) ])),
    } : null;
    const title = options.title ?? research?.title ?? idea?.trim().slice(0, 100) ?? 'Untitled film';
    const project = path.join(staging, 'project');
    const sb = scaffold(project, { ...options, title, theme: options.theme ?? brand?.theme,
      playbook: options.playbook ?? (options.treatment || options.direction ? undefined : (documents.length ? 'research-digest' : 'concept-explainer')) });
    const inventory = applyBrand(project, sb, brand, { theme: options.theme });
    // Keep sample attribution on the starter's illustrative figures. The report's sources
    // live in its evidence brief until an author binds real claims to rewritten beats.
    if (collected.length) {
      for (const d of collected) {
        fs.mkdirSync(path.join(project, d.base), { recursive: true });
        fs.renameSync(d.stagedInput, path.join(project, d.rel));
        fs.writeFileSync(path.join(project, d.base, 'document.md'), d.source);
        writeJSON(path.join(project, d.base, 'research.json'), d.research);
      }
      writeJSON(path.join(project, 'source/research.json'), research);
      fs.writeFileSync(path.join(project, 'EVIDENCE.md'), collected.map(d =>
        (collected.length > 1 ? `# Document ${d.id}: ${inputs.find(i => i.id === d.id).name}\n\nCitations in this section belong only to ${d.rel}. Aggregated research IDs use ${d.id}: prefixes.\n\n` : '') +
        briefMarkdown(d.research, d.rel)).join('\n---\n\n'));
    }
    vendor(project, [['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base], ['types', sb.type], ...artSketches(sb)]);
    writeJSON(path.join(project, 'storyboard.json'), sb);
    const brief = fs.readFileSync(path.join(project, 'BRIEF.md'), 'utf8');
    fs.writeFileSync(path.join(project, 'BRIEF.md'), `# Production brief: ${title}\n\n` +
      `Idea: ${idea?.trim() ?? 'Develop the question and turn from EVIDENCE.md.'}\nAudience: ${audience ?? 'To be decided'}\nTakeaway: ${takeaway ?? 'To be decided'}\n` +
      `${brand ? '\nBrand: BRAND.md (assets and rules).\n' : ''}${research ? '\nEvidence: EVIDENCE.md and source/research.json.\n' : ''}\n` +
      picturesFor(collected.map(d => d.source).join('\n')) +
      `## Starter arc\n${brief.replace(/^# .*\n/, '')}\n## Next pass\n` +
      `1. Choose the question, tension, turn and payoff in DIRECTION.md.\n2. Rewrite the sample beats around the source. Bind every figure to its visible source.\n3. Place the supplied assets where they support the story.\n4. Run critique, then draft; review the complete film before polishing individual shots.\n`);
    fs.appendFileSync(path.join(project, 'DIRECTION.md'), `\n## Intake\nRead BRIEF.md${research ? ', EVIDENCE.md' : ''}${brand ? ' and BRAND.md' : ''}. ` +
      `The storyboard is still an illustrative starting arc. Keep factual claims tied to the supplied material.\n` +
      `Audience: ${audience ?? 'To be decided'}\nTakeaway: ${takeaway ?? 'To be decided'}\n`);
    const receipt = { version: 1, status: 'starter-needs-direction', title, idea: idea?.trim() ?? null,
      audience: audience ?? null, takeaway: takeaway ?? null, inputs, assets: inventory,
      evidence: research ? { figures: research.figures.length, sourced: research.figures.filter(f => f.sources.length).length,
        sources: research.sources.length, tables: research.tables.length } : null,
      next: ['direction', 'rewrite-sample-beats', 'place-brand-assets', 'critique', 'draft', 'review'] };
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
