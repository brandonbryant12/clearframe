import path from 'node:path';

import { resolveProject } from '../lib/project.mjs';

import {
  playbookFor,
  playbookNote,
  scaffold,
  writeGallery,
} from '../../film/playbooks.mjs';

import * as native from '../../film/production.mjs';
import type { CommandContext } from './options.mjs';

export async function handoffCommand({ positionals, o, opts }: CommandContext) {
  if (!positionals[0]) throw new Error('handoff needs a project directory');
  const { exportHandoff, verifyHandoff } = await import('../lib/handoff.mjs');
  if (o.verify) {
    const result = verifyHandoff(positionals[0]);
    return console.log(
      o.json
        ? JSON.stringify(result, null, 2)
        : `Verified ${result.verified} files for ${result.revision} in ${result.directory}`,
    );
  }
  const result = exportHandoff(resolveProject(positionals[0]), opts);
  return console.log(
    o.json
      ? JSON.stringify(result, null, 2)
      : `Exported ${result.revision} to ${result.directory}\n${result.warnings.map((w) => `- ${w}`).join('\n')}`,
  );
}

export async function museCommand({ o, opts }: CommandContext) {
  const { muse, museMarkdown } = await import('../../film/muse.mjs');
  const m = muse(opts.seed ?? Math.floor(Math.random() * 100000), {
    dark: !o.light,
  });
  return console.log(o.json ? JSON.stringify(m, null, 2) : museMarkdown(m));
}

export async function startCommand({ positionals, o, opts }: CommandContext) {
  if (!positionals[0]) throw new Error('start needs a new project directory');
  const { startProject } = await import('../lib/start.mjs');
  const r = startProject(positionals[0], opts);
  const note = playbookNote(opts);
  if (note) console.error(note);
  if (o.json) return console.log(JSON.stringify(r, null, 2));
  return console.log(
    `Created ${positionals[0]}: ${r.inputs.length} document, ${r.assets.length} brand assets. Read BRIEF.md${r.evidence ? ' and EVIDENCE.md' : ''}; rewrite the sample beats, then run critique and draft.`,
  );
}

export async function newCommand({ positionals, o, opts }: CommandContext) {
  const dir = path.resolve(positionals[0] ?? 'my-video');
  // A playbook cut from a recording, scaffolded on its own, puts sample narration where the
  // recording belongs; agents then laid the episode under it as music, out of sync.
  const book = playbookFor(opts);
  if (book.recording && !o.sample)
    throw new Error(
      `${book.id} cuts a recording: its narration is the recording's own words with measured timings. Import it instead:\n  clearframe ingest ${positionals[0] ?? 'DIR'} --audio episode.wav [--script turns.txt] [--speakers host=Name:Host,guest=Name:Guest] [--vertical] --direction ${o.direction ?? (book.id === 'podcast-clip' ? 'podcast-picture' : 'ID')}\nThen replace its captions with pictures beat by beat. (To read the sample playbook anyway: new DIR --playbook ${book.id} --sample.)`,
    );
  const sb = scaffold(dir, opts);
  const rel = path.relative(process.cwd(), dir) || '.';
  const note = playbookNote(opts);
  if (note) console.error(note);
  return console.log(
    `Created ${rel} (${sb.beats.length} beats, ${typeof sb.theme === 'string' ? sb.theme : (sb.theme?.base ?? 'paper')} palette). Replace the illustrative claims, then:\n  clearframe sheet ${rel} --draft     # contact sheet to review\n  clearframe voice ${rel} --draft     # free local narration\n  clearframe render ${rel} --draft    # fast review MP4`,
  );
}

export async function galleryCommand({ positionals, opts }: CommandContext) {
  const dir = path.resolve(positionals[0] ?? 'build/native-gallery');
  await writeGallery(dir, opts);
  return console.log(
    await native.sheetProject(dir, {
      ...opts,
      draft: true,
      per: 1,
      columns: 4,
    }),
  );
}
