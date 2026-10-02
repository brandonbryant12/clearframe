// Optional creative starting points. Storyboards and custom scenes remain fully editable.
import { items, item } from './library.mjs';

export const directions = material => items('directions').filter(d => !material || d.materials.includes(material));
export function directionById(id) {
  const found = item('directions', id);
  if (!found) throw new Error(`Unknown direction ${id}. Run clearframe directions, or add library/directions/${id}.json.`);
  return found;
}
export function directionOptions(options) {
  if (!options.direction) return options;
  const d = directionById(options.direction);
  return { ...options, playbook: options.playbook ?? options.recipe ?? d.playbook, treatment: options.treatment ?? d.treatment };
}
export function directionMarkdown(id, { recording = false } = {}) {
  if (!id) return '';
  const d = directionById(id);
  return `\n## Starting direction: ${d.title}\n\n${d.when}\n\n` +
    `- Story: ${d.story}\n- Picture: ${d.picture}\n- Pace: ${d.pace}\n` +
    d.rules.map(r => `- ${r}\n`).join('') +
    (recording ? `\nThe ${d.playbook} playbook is a visual reference only. Imported beats retain the recording, timing and speakers. Give those beats new pictures; keep their IDs, vo and recorded audio.\n` : '') +
    '\nThis is a starting hypothesis, not a required sequence. Change the arc, combine treatments, draw a new canvas scene or use a custom library. Before authoring, propose an alternative with a different visual metaphor, camera grammar and rhythm. Record the chosen departure here. Palette changes alone do not count as a new direction.\n';
}

/** Keep a custom direction and its referenced library items portable, even if overridden. */
export function directionRefs(id) {
  const refs = new Map();
  function visit(kind, name) {
    if (!name || refs.has(`${kind}/${name}`)) return;
    const it = item(kind, name);
    if (!it) return;
    refs.set(`${kind}/${name}`, [kind, name]);
    if (kind === 'directions') {
      visit('playbooks', it.playbook);
      visit('treatments', it.treatment);
    } else if (kind === 'treatments') {
      visit('playbooks', it.playbook);
      visit('palettes', typeof it.film?.theme === 'string' ? it.film.theme : it.film?.theme?.base);
      visit('types', it.film?.type);
    } else if (kind === 'playbooks') {
      visit('palettes', typeof it.theme === 'string' ? it.theme : it.theme?.base);
      visit('types', it.type);
      for (const beat of it.beats) {
        visit('sketches', beat.props?.sketch);
        visit('sketches', beat.art?.sketch);
      }
    }
  }
  visit('directions', id);
  return [...refs.values()];
}
