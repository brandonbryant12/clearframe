import type { LibraryKind } from './types.mjs';
export interface DirectionOptions {
  direction?: string;
  playbook?: string;
  recipe?: string;
  treatment?: string;
}
export type LibraryRef = readonly [LibraryKind, string | null | undefined];
// Optional creative starting points. Storyboards and custom scenes remain fully editable.
import { items, item } from './library.mjs';

export const directions = (material?: string) =>
  items('directions').filter(
    (d) => !material || d.materials.includes(material),
  );
export function directionById(id: string) {
  const found = item('directions', id);
  if (!found)
    throw new Error(
      `Unknown direction ${id}. Run clearframe directions, or add library/directions/${id}.json.`,
    );
  return found;
}
export function directionOptions<T extends DirectionOptions>(options: T) {
  if (!options.direction) return options;
  const d = directionById(options.direction);
  return {
    ...options,
    playbook: options.playbook ?? options.recipe ?? d.playbook,
    treatment: options.treatment ?? d.treatment,
  };
}
export function directionMarkdown(
  id: string | null | undefined,
  {
    recording = false,
    playbook,
  }: { recording?: boolean; playbook?: string } = {},
): string {
  if (!id) return '';
  const d = directionById(id);
  return (
    `\n## Starting direction: ${d.title}\n\n${d.when}\n\n` +
    `- Story: ${d.story}\n- Picture: ${d.picture}\n- Pace: ${d.pace}\n` +
    d.rules.map((r) => `- ${r}\n`).join('') +
    (recording
      ? `\nThe ${playbook ?? d.playbook} playbook is a visual reference only. Imported beats retain the recording, timing and speakers. Give those beats new pictures; keep their IDs, vo and recorded audio.\n`
      : '') +
    '\nThis is a starting hypothesis, not a required sequence. Change the arc, combine treatments, draw a new canvas scene or use a custom library. Before authoring, propose an alternative with a different visual metaphor, camera grammar and rhythm. Record the chosen departure here. Palette changes alone do not count as a new direction.\n'
  );
}

/** Keep a custom direction and its referenced library items portable, even if overridden. */
export function directionRefs(
  id: string | null | undefined,
  selected: readonly LibraryRef[] = [],
): [LibraryKind, string][] {
  const refs = new Map<string, [LibraryKind, string]>();
  function visit(kind: LibraryKind, name: string | null | undefined): void {
    if (!name || refs.has(`${kind}/${name}`)) return;
    if (!item(kind, name)) return;
    refs.set(`${kind}/${name}`, [kind, name]);
    for (const [next, ref] of dependencies(kind, name)) visit(next, ref);
  }
  visit('directions', id);
  for (const [kind, name] of selected) visit(kind, name);
  return [...refs.values()];
}
function dependencies(kind: LibraryKind, name: string): LibraryRef[] {
  if (kind === 'directions') {
    const it = item('directions', name);
    return it
      ? [
          ['playbooks', it.playbook],
          ['treatments', it.treatment],
        ]
      : [];
  }
  if (kind === 'treatments') {
    const it = item('treatments', name);
    return it
      ? [
          ['playbooks', it.playbook],
          [
            'palettes',
            typeof it.film.theme === 'string'
              ? it.film.theme
              : it.film.theme?.base,
          ],
          ['types', it.film.type],
        ]
      : [];
  }
  if (kind === 'playbooks') return playbookDependencies(name);

  return [];
}

function playbookDependencies(name: string): LibraryRef[] {
  const it = item('playbooks', name);
  if (!it) return [];
  const refs: LibraryRef[] = [
    ['palettes', typeof it.theme === 'string' ? it.theme : it.theme?.base],
    ['types', it.type],
  ];
  for (const beat of it.beats)
    refs.push(['sketches', beat.props?.sketch], ['sketches', beat.art?.sketch]);
  return refs;
}
