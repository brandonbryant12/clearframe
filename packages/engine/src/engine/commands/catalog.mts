import {
  BLOCKS,
  THEMES,
  THEME_NOTES,
  MOTIONS,
  TRANSITIONS,
  BACKDROPS,
  markdownCatalog,
} from '../../film/catalog.mjs';
import { playbooks } from '../../film/playbooks.mjs';
import { ICONS, ICON_SOURCE } from '../../film/icons.mjs';

import { treatments } from '../../film/treatments.mjs';
import { directions } from '../../film/directions.mjs';
import { types } from '../../film/library.mjs';

import type { CommandContext } from './options.mjs';

export async function directionsCommand({ positionals, o }: CommandContext) {
  const found = directions(positionals[0]);
  if (!found.length)
    throw new Error(
      `No directions for ${positionals[0]}. Run clearframe directions to list all.`,
    );
  return console.log(
    o.json
      ? JSON.stringify(found, null, 2)
      : found
          .map(
            (d) =>
              `${d.id.padEnd(23)} ${d.title}\n  ${d.when}\n  Story: ${d.story}\n  Picture: ${d.picture}\n  Pace: ${d.pace}\n  Start: ${d.playbook} + ${d.treatment}`,
          )
          .join('\n\n') +
          '\n\nUse --direction ID with new, start or ingest. Override --playbook, --treatment or --theme independently. Every scene remains editable; add your own JSON directions in --library DIR.',
  );
}

export async function playbooksCommand({ o }: CommandContext) {
  return console.log(
    o.json
      ? JSON.stringify(playbooks(), null, 2)
      : playbooks()
          .map(
            (p) =>
              `${p.id.padEnd(24)} ${p.title}\n  ${p.audience} · ${p.inputs}`,
          )
          .join('\n'),
  );
}

export async function blocksCommand({ positionals, o }: CommandContext) {
  const b = positionals[0]
    ? BLOCKS.find((b) => b.name === positionals[0])
    : null;
  if (positionals[0] && !b) {
    const { notABlock } = await import('../../film/catalog.mjs');
    throw new Error(`No block ${positionals[0]}. ${notABlock(positionals[0])}`);
  }
  if (o.md) return console.log(markdownCatalog());
  if (o.json || b) return console.log(JSON.stringify(b ?? BLOCKS, null, 2));
  const groups = [...new Set(BLOCKS.map((b) => b.category))];
  return console.log(
    groups
      .map(
        (g) =>
          `${g.toUpperCase()}\n${BLOCKS.filter((b) => b.category === g)
            .map((b) => `  ${b.name.padEnd(12)} ${b.summary}`)
            .join('\n')}`,
      )
      .join('\n\n') +
      '\n\nclearframe blocks NAME shows props and a ready-to-paste example.',
  );
}

export async function themesCommand({ o }: CommandContext) {
  if (o.json) return console.log(JSON.stringify(THEMES, null, 2));
  const swatch = (hex: string) =>
    process.stdout.isTTY
      ? `\x1b[48;2;${hex
          .slice(1)
          .match(/../g)
          ?.map((v) => parseInt(v, 16))
          .join(';')}m   \x1b[0m`
      : '';
  return console.log(
    Object.entries(THEMES)
      .map(
        ([name, t]) =>
          `${name.padEnd(10)} ${['bg', 'surface', 'ink', 'muted', 'accent', 'accent2'].map((k) => swatch(t[k])).join('')} ${THEME_NOTES[name]}`,
      )
      .join('\n') +
      '\n\nOverride any token in storyboard.json: "theme": {"base": "ink", "accent": "#d6acff"}. Compare palettes with: clearframe looks DIR --beat ID',
  );
}

export async function iconsCommand({ o }: CommandContext) {
  if (o.json)
    return console.log(
      JSON.stringify({ icons: ICONS, ...ICON_SOURCE }, null, 2),
    );
  const width = Math.max(...ICONS.map((i) => i.length)) + 2;
  const rows = [];
  for (let i = 0; i < ICONS.length; i += 6)
    rows.push(
      ICONS.slice(i, i + 6)
        .map((n) => n.padEnd(width))
        .join('')
        .trimEnd(),
    );
  return console.log(
    `${rows.join('\n')}\n\n${ICONS.length} MIT Tabler icons · ${ICON_SOURCE.repository} @ ${ICON_SOURCE.revision.slice(0, 12)}`,
  );
}

export async function treatmentsCommand({ o }: CommandContext) {
  return console.log(
    o.json
      ? JSON.stringify(treatments(), null, 2)
      : treatments()
          .map(
            (t) =>
              `${t.id.padEnd(11)} ${t.title}\n            ${t.when}\n            ${[t.film.theme, `type ${t.film.type ?? 'inter'}`, t.film.motion?.preset, t.film.transition, t.film.frame && 'frame', t.beats?.rough && 'rough strokes', t.film.sfx && t.film.sfx !== 'off' && `sfx ${t.film.sfx}`].filter(Boolean).join(' · ')}`,
          )
          .join('\n') +
          '\n\nclearframe new DIR --playbook NAME --treatment ID applies one and writes DIRECTION.md.',
  );
}

export async function typesCommand({ o }: CommandContext) {
  return console.log(
    o.json
      ? JSON.stringify(types(), null, 2)
      : types()
          .map(
            (t) =>
              `${t.id.padEnd(11)} ${t.title}\n            ${t.when}\n            ${[t.display, `emphasis ${t.emphasis ?? 'accent'}`, t.case === 'upper' && 'capitals'].filter(Boolean).join(' · ')}`,
          )
          .join('\n') +
          '\n\nA treatment sets film.type; a storyboard or one beat can set "type" too. Body copy, labels and counters stay in Inter.',
  );
}

export async function motionsCommand() {
  return console.log(
    JSON.stringify(
      {
        presets: MOTIONS,
        intensity: '0–1',
        transitions: TRANSITIONS,
        exits:
          'auto (mirror the next entrance) | none | fade | push | zoom | wipe | panel',
        backdrops: BACKDROPS,
      },
      null,
      2,
    ),
  );
}

/** The machine-readable contract an agent framework reads before calling ClearFrame. */
export async function capabilitiesCommand({ o }: CommandContext) {
  const { capabilities } = await import('../lib/capabilities.mjs');
  const c = capabilities();
  if (o.json) return console.log(JSON.stringify(c, null, 2));
  return console.log(
    [
      `ClearFrame contracts v${c.contractVersion} (JSON with --json; schemas also from clearframe/contracts)`,
      ...c.operations.map(
        (op) => `  ${op.call.padEnd(36)} ${op.effect.padEnd(5)} ${op.summary}`,
      ),
      `  job kinds: ${c.jobs.kinds.join(', ')}`,
      `  terminal statuses: ${c.jobs.terminal.join(', ')}`,
    ].join('\n'),
  );
}
