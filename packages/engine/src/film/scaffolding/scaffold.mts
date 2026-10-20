import type {
  PlaybookItem,
  PlaybookEnding,
  TreatmentVariant,
} from '../types.mjs';
import type { Storyboard } from '../../engine/domain.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { palette } from '../catalog.mjs';
import { writeJSON } from '../../engine/lib/util.mjs';
import { wireframePNG } from '../wireframe.mjs';

import { vendor } from '../library.mjs';
import { muse, museMarkdown } from '../muse.mjs';
import {
  applyTreatment,
  directionTemplate,
  pickVariant,
  treatmentById,
} from '../treatments.mjs';
import {
  directionOptions,
  directionMarkdown,
  directionRefs,
} from '../directions.mjs';
import type { ScaffoldOptions } from './contracts.mjs';
import { playbooks, endingFor, storyboardFor } from './storyboard.mjs';
import { artSketches } from './sketches.mjs';

/** A note when a treatment made for certain playbooks starts from another (workplace from data-story). */
export function playbookNote(options: ScaffoldOptions = {}) {
  const t = options.treatment ? treatmentById(options.treatment) : undefined,
    book = playbookFor(options);
  if (!t?.playbooks?.length || t.playbooks.includes(book.id)) return null;
  return `Note: the ${options.treatment} treatment is made for the ${t.playbooks.join(', ')} playbooks; ${book.id} is not one of them, and its beats are not this treatment's pictures. Start again with one of those unless the brief really is a ${book.id}.`;
}

/** The playbook a `new` with these options starts from (direction, treatment and default applied). */
export function playbookFor(
  options: ScaffoldOptions = {},
): Pick<PlaybookItem, 'id' | 'recording'> {
  options = directionOptions(options);
  const id =
    options.playbook ??
    options.recipe ??
    (options.treatment && treatmentById(options.treatment)?.playbook) ??
    'concept-explainer';
  return playbooks().find((p) => p.id === id) ?? { id };
}

export function scaffold(dir: string, options: ScaffoldOptions = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length)
    throw new Error(`${dir} is not empty`);
  options = directionOptions(options);
  const id =
      options.playbook ??
      options.recipe ??
      (options.treatment && treatmentById(options.treatment)?.playbook) ??
      'concept-explainer',
    book = playbooks().find((p) => p.id === id);
  if (!book) throw new Error(`Unknown playbook ${id}`);
  const { sb, ending, look, drawn } = styleScaffold(options, dir, book, id);
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  vendor(dir, [
    ['palettes', typeof sb.theme === 'string' ? sb.theme : sb.theme?.base],
    ['treatments', options.treatment],
    ['types', sb.type],
    ...directionRefs(options.direction, [
      ['treatments', options.treatment],
      ['playbooks', id],
    ]),
    ...artSketches(sb),
  ]);
  writeDirectionFile({ dir, sb, options, ending, book, id, look, drawn });
  // Placeholder screenshots are generated locally: text-free, palette-matched and clearly illustrative.
  if (sb.beats.some((b) => b.props?.file === 'assets/screen.png')) {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'assets/screen.png'),
      wireframePNG(palette(sb.theme)),
    );
  }
  fs.writeFileSync(
    path.join(dir, 'BRIEF.md'),
    `# ${sb.title}\n\nPlaybook: ${id}\nAudience: ${book.audience}\nRequired inputs: ${book.inputs}\n\n${book.note ?? ''}\n\nReplace all sample claims and sources. Choose a palette and motion intensity in storyboard.json. The playbook is a starting structure: add, remove or reorder native blocks to serve the story.\n`,
  );
  return sb;
}

function writeDirectionFile({
  dir,
  sb,
  options,
  ending,
  book,
  id,
  look,
  drawn,
}: WriteDirectionFileContext) {
  fs.writeFileSync(
    path.join(dir, 'DIRECTION.md'),
    directionTemplate(
      sb,
      options.treatment ? treatmentById(options.treatment) : null,
    ) +
      (ending && book.endings && book.endings.length > 1
        ? `\n## Ending\n\nThe ${id} playbook's \`${ending.name}\` ending (picked for this project; another folder, \`--seed\` or \`--ending NAME\` picks another: ${book.endings.map((e) => e.name).join(', ')}): ${ending.about}\n`
        : '') +
      (look
        ? `\n## Look\n\nThe ${options.treatment} treatment's \`${look.name}\` look (picked for this project; another folder or \`--seed\` picks another): palette \`${sb.theme}\`, type \`${sb.type ?? 'inter'}\`${lookFinish(look)}. Keep it unless the brand or the brief asks for another; it is what keeps this film from looking like the last one.\n`
        : '') +
      directionMarkdown(options.direction) +
      (drawn ? `\n${museMarkdown(drawn)}` : ''),
  );
}

function styleScaffold(
  options: ScaffoldOptions,
  dir: string,
  book: PlaybookItem,
  id: string,
) {
  const variantKey = options.seed ?? path.basename(path.resolve(dir));
  // Like a treatment's looks, a playbook's endings are picked per project (or named with --ending).
  const ending = options.ending
    ? endingFor(book, options.ending)
    : pickVariant(book?.endings, `${variantKey}/ending`);
  const sb = storyboardFor(id, { ...options, ending: ending?.name });
  // The length the person asked for, in seconds: `draft` says when the film falls well short of it.
  if (options.length) sb.length = options.length;
  const look =
    options.treatment && !options.theme
      ? pickVariant(treatmentById(options.treatment)?.variants, variantKey)
      : null;
  if (options.treatment) {
    applyTreatment(sb, options.treatment, {
      variant: options.theme ? null : variantKey,
    });
    if (options.theme) sb.theme = options.theme;
  }
  // A creative seed varies the look on top of the arc and treatment, and briefs the director.
  const drawn = options.seed != null ? muse(options.seed) : null;
  if (drawn) {
    if (!options.theme) sb.theme = drawn.palette;
    sb.lens = { blur: 0.5, ...(sb.lens ?? {}) };
    sb.textMotion = drawn.textMotion;
    sb.transition = drawn.apply.transition;
  }
  return { sb, ending, look, drawn };
}

interface WriteDirectionFileContext {
  dir: string;
  sb: Storyboard;
  options: ScaffoldOptions;
  ending: PlaybookEnding | null;
  book: PlaybookItem;
  id: string;
  look: TreatmentVariant | null;
  drawn: ReturnType<typeof muse> | null;
}

function lookFinish(look: TreatmentVariant): string {
  if (look.beats?.rough) return ', drawn by hand';
  const print = look.beats?.print;
  if (!print) return ', clean lines';
  return `, printed (${typeof print === 'string' ? print : 'print'})`;
}
