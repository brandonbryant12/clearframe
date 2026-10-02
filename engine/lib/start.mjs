// Portable intake for an agent-directed film. No generation, guessing of claims, or paid calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { scaffold, artSketches } from '../../fframes/playbooks.mjs';
import { palette } from '../../fframes/catalog.mjs';
import { contrast, typeById, vendor, useProject } from '../../fframes/library.mjs';
import { documentMarkdown, parseResearch, briefMarkdown } from './ingest.mjs';
import { writeJSON } from './util.mjs';

// A kit can contain large recordings: copy on disk and hash with bounded memory.
function copyInput(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
  const digest = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(destination, 'r');
  let bytes = 0;
  try {
    for (;;) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!count) break;
      digest.update(buffer.subarray(0, count));
      bytes += count;
    }
  } finally { fs.closeSync(fd); }
  return { sha256: digest.digest('hex'), bytes };
}
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const nonempty = v => typeof v === 'string' && v.trim().length > 0;
const extensions = { image: ['.png', '.jpg', '.jpeg', '.webp'], clip: ['.mp4', '.mov'], sfx: ['.wav', '.mp3', '.m4a'] };

function readBrand(file) {
  if (!file) return null;
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!object(spec)) throw new Error('brand must be a JSON object');
  const allowed = ['name', 'theme', 'type', 'voiceStyle', 'rules', 'assets'];
  for (const key of Object.keys(spec)) if (!allowed.includes(key)) throw new Error(`Unknown brand field: ${key}`);
  if (!nonempty(spec.name) || spec.name.length > 80) throw new Error('brand.name must be 1–80 characters');
  if (spec.theme != null) {
    const colors = palette(spec.theme);
    for (const [key, minimum] of [['ink', 4.5], ['muted', 4.5], ['accent', 4.5], ['accent2', 3]]) {
      if (contrast(colors[key], colors.bg) < minimum) throw new Error(`brand.theme.${key} needs ${minimum}:1 contrast against bg`);
    }
  }
  if (spec.type != null && (typeof spec.type !== 'string' || !typeById(spec.type)))
    throw new Error('brand.type must name an installed type voice (clearframe types)');
  if (spec.voiceStyle != null && (!nonempty(spec.voiceStyle) || spec.voiceStyle.length > 1000))
    throw new Error('brand.voiceStyle must be 1–1000 characters');
  if (spec.rules != null && (!Array.isArray(spec.rules) || spec.rules.some(r => !nonempty(r))))
    throw new Error('brand.rules must be a list of nonempty strings');
  if (spec.assets != null && !Array.isArray(spec.assets)) throw new Error('brand.assets must be a list');
  const ids = new Set();
  const assets = (spec.assets ?? []).map(a => {
    if (!object(a)) throw new Error('Each brand asset must be an object');
    for (const key of Object.keys(a)) if (!['id', 'kind', 'file', 'role'].includes(key)) throw new Error(`Unknown brand asset field: ${key}`);
    if (!nonempty(a.id) || !/^[a-z0-9][a-z0-9_-]*$/i.test(a.id) || ids.has(a.id.toLowerCase())) throw new Error('Brand asset IDs must be unique slugs');
    ids.add(a.id.toLowerCase());
    const kind = a.kind ?? 'image';
    if (!nonempty(a.file) || typeof kind !== 'string' || !Object.hasOwn(extensions, kind) || !extensions[kind]?.includes(path.extname(a.file).toLowerCase()))
      throw new Error(`Unsupported brand asset ${a.id}: use a local PNG/JPEG/WebP image, MP4/MOV clip, or WAV/MP3/M4A sound`);
    if (a.role != null && !nonempty(a.role)) throw new Error(`brand asset ${a.id}.role must be text`);
    const source = path.resolve(path.dirname(file), a.file);
    if (!fs.statSync(source).isFile()) throw new Error(`Brand asset ${a.id} is not a regular file`);
    return { ...a, kind, source, file: `assets/brand/${a.id}${path.extname(a.file).toLowerCase()}` };
  });
  return { ...spec, assets };
}

/** Create a new project as a transaction; a failed intake leaves an existing destination intact. */
export function startProject(destination, options = {}) {
  const { idea, document, brand: brandFile, audience, takeaway } = options;
  if (!nonempty(idea) && !document) throw new Error('start needs --idea text, --document file, or both');
  for (const [key, value] of Object.entries({ idea, audience, takeaway }))
    if (value != null && !nonempty(value)) throw new Error(`--${key} must not be empty`);
  const root = path.resolve(destination);
  if (fs.existsSync(root) && (!fs.statSync(root).isDirectory() || fs.readdirSync(root).length))
    throw new Error(`${root} is not empty; start creates a new project`);
  useProject(null);
  // Validate brand settings before staging; source parsing uses the staged original.
  const brand = readBrand(brandFile && path.resolve(brandFile));
  const documentPath = document && path.resolve(document);
  fs.mkdirSync(path.dirname(root), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(root), '.clearframe-start-'));
  try {
    // Parse the exact copy named by the receipt, even if the external file changes later.
    const inputs = [];
    const rel = documentPath && `source/original${path.extname(documentPath).toLowerCase()}`;
    const stagedInput = path.join(staging, 'input' + (documentPath ? path.extname(documentPath).toLowerCase() : ''));
    let source = null, research = null;
    if (documentPath) {
      const copied = copyInput(documentPath, stagedInput);
      inputs.push({ file: rel, name: path.basename(documentPath), ...copied });
      source = documentMarkdown(stagedInput);
      research = parseResearch(source);
    }
    const title = options.title ?? research?.title ?? idea?.trim().slice(0, 100) ?? 'Untitled film';
    const project = path.join(staging, 'project');
    const sb = scaffold(project, { ...options, title, theme: options.theme ?? brand?.theme,
      playbook: options.playbook ?? (options.treatment || options.direction ? undefined : (document ? 'research-digest' : 'concept-explainer')) });
    if (brand?.type) sb.type = brand.type;
    if (brand?.voiceStyle) sb.voice = { ...(sb.voice ?? {}), style: brand.voiceStyle };
    if (brand && sb.frame) sb.frame = { ...(object(sb.frame) ? sb.frame : {}), brand: brand.name };
    const inventory = [];
    for (const asset of brand?.assets ?? []) {
      if ((sb.assets ?? []).some(a => a.id === asset.id)) throw new Error(`Brand asset ID ${asset.id} conflicts with the playbook`);
      const copied = copyInput(asset.source, path.join(project, asset.file));
      const entry = { id: asset.id, kind: asset.kind, file: asset.file, role: asset.role ?? 'reference', ...copied };
      inventory.push(entry);
      (sb.assets ??= []).push({ id: asset.id, kind: asset.kind, file: asset.file });
    }
    // Keep sample attribution on the starter's illustrative figures. The report's sources
    // live in its evidence brief until an author binds real claims to rewritten beats.
    if (documentPath) {
      fs.mkdirSync(path.join(project, 'source'), { recursive: true });
      fs.renameSync(stagedInput, path.join(project, rel));
      fs.writeFileSync(path.join(project, 'source/document.md'), source);
      writeJSON(path.join(project, 'source/research.json'), research);
      fs.writeFileSync(path.join(project, 'EVIDENCE.md'), briefMarkdown(research, rel));
    }
    if (brand) {
      writeJSON(path.join(project, 'brand.json'), { ...brand, assets: brand.assets.map(({ source, ...a }) => a) });
      fs.writeFileSync(path.join(project, 'BRAND.md'), `# ${brand.name}\n\n` +
        `Palette: ${JSON.stringify(sb.theme)}\nType voice: ${sb.type ?? 'inter'}\n\n## Rules\n${(brand.rules ?? []).map(r => `- ${r}`).join('\n')}\n\n` +
        `## Assets\n${inventory.map(a => `- ${a.id}: ${a.file} (${a.role}); SHA-256 ${a.sha256}`).join('\n')}\n\nUse the supplied identity unchanged. Assets are registered for placement by the director; they are not automatically overlaid on every scene.\n`);
    }
    vendor(project, [['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base], ['types', sb.type], ...artSketches(sb)]);
    writeJSON(path.join(project, 'storyboard.json'), sb);
    const brief = fs.readFileSync(path.join(project, 'BRIEF.md'), 'utf8');
    fs.writeFileSync(path.join(project, 'BRIEF.md'), `# Production brief: ${title}\n\n` +
      `Idea: ${idea?.trim() ?? 'Develop the question and turn from EVIDENCE.md.'}\nAudience: ${audience ?? 'To be decided'}\nTakeaway: ${takeaway ?? 'To be decided'}\n` +
      `${brand ? '\nBrand: BRAND.md (assets and rules).\n' : ''}${research ? '\nEvidence: EVIDENCE.md and source/research.json.\n' : ''}\n` +
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
