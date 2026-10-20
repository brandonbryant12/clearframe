import fs from 'node:fs';
import { REVIEW } from '../lib/review-cli.mjs';
import type { CommandContext } from './options.mjs';
import {
  handoffCommand,
  museCommand,
  startCommand,
  newCommand,
  galleryCommand,
} from './authoring.mjs';
import {
  directionsCommand,
  playbooksCommand,
  blocksCommand,
  themesCommand,
  iconsCommand,
  treatmentsCommand,
  typesCommand,
  motionsCommand,
} from './catalog.mjs';
import {
  referenceCommand,
  planCommand,
  speechCommand,
  alignCommand,
  align2Command,
  timingCommand,
} from './audio.mjs';
import { findCommand, sketchCommand } from './discovery.mjs';
import {
  doctorCommand,
  buildCommand,
  reviewCommand,
  checkCommand,
  stillCommand,
  worldCommand,
  sheetCommand,
  looksCommand,
  review2Command,
  previewCommand,
  renderCommand,
} from './render.mjs';
import { viewerCommand, agentCommand, studioCommand } from './studio.mjs';
import { ingestCommand } from './intake.mjs';
import { beatmapCommand, beatmap2Command } from './beatmap.mjs';
import {
  pipelineCommand,
  draftCommand,
  checkpointsCommand,
  critiqueCommand,
} from './production.mjs';
import { qaCommand } from './qa.mjs';

interface Command {
  matches: (context: CommandContext) => boolean;
  run: (context: CommandContext) => Promise<unknown>;
}
export const standaloneCommands: readonly Command[] = [
  { matches: ({ cmd }) => cmd === 'handoff', run: handoffCommand },
  { matches: ({ cmd }) => cmd === 'muse', run: museCommand },
  { matches: ({ cmd }) => cmd === 'start', run: startCommand },
  { matches: ({ cmd }) => cmd === 'new', run: newCommand },
  { matches: ({ cmd }) => cmd === 'directions', run: directionsCommand },
  {
    matches: ({ cmd }) => ['playbooks', 'recipes'].includes(cmd),
    run: playbooksCommand,
  },
  { matches: ({ cmd }) => cmd === 'blocks', run: blocksCommand },
  { matches: ({ cmd }) => cmd === 'themes', run: themesCommand },
  { matches: ({ cmd }) => cmd === 'icons', run: iconsCommand },
  { matches: ({ cmd }) => cmd === 'reference', run: referenceCommand },
  { matches: ({ cmd }) => cmd === 'treatments', run: treatmentsCommand },
  { matches: ({ cmd }) => cmd === 'types', run: typesCommand },
  { matches: ({ cmd }) => cmd === 'find', run: findCommand },
  { matches: ({ cmd }) => cmd === 'sketch', run: sketchCommand },
  { matches: ({ cmd }) => cmd === 'motions', run: motionsCommand },
  { matches: ({ cmd }) => cmd === 'doctor', run: doctorCommand },
  { matches: ({ cmd }) => cmd === 'build', run: buildCommand },
  { matches: ({ cmd }) => cmd === 'viewer', run: viewerCommand },
  { matches: ({ cmd }) => cmd === 'agent', run: agentCommand },
  { matches: ({ cmd }) => cmd === 'gallery', run: galleryCommand },
  { matches: ({ cmd }) => cmd === 'ingest', run: ingestCommand },
  {
    matches: ({ cmd, positionals }) =>
      cmd === 'beatmap' &&
      !!positionals[0] &&
      fs.statSync(positionals[0]).isFile(),
    run: beatmapCommand,
  },
];
export const projectCommands: readonly Command[] = [
  { matches: ({ cmd }) => cmd === 'studio', run: studioCommand },
  { matches: ({ cmd }) => REVIEW.has(cmd), run: reviewCommand },
  {
    matches: ({ cmd }) =>
      ['plan', 'voice', 'music', 'images', 'clips'].includes(cmd),
    run: planCommand,
  },
  { matches: ({ cmd }) => cmd === 'speech', run: speechCommand },
  {
    matches: ({ cmd, o }) => cmd === 'align' && !!o.whisper,
    run: alignCommand,
  },
  { matches: ({ cmd }) => cmd === 'align', run: align2Command },
  {
    matches: ({ cmd }) => ['timing', 'captions'].includes(cmd),
    run: timingCommand,
  },
  { matches: ({ cmd }) => cmd === 'pipeline', run: pipelineCommand },
  { matches: ({ cmd }) => cmd === 'draft', run: draftCommand },
  { matches: ({ cmd }) => cmd === 'checkpoints', run: checkpointsCommand },
  { matches: ({ cmd }) => cmd === 'critique', run: critiqueCommand },
  { matches: ({ cmd }) => cmd === 'check', run: checkCommand },
  { matches: ({ cmd }) => cmd === 'still', run: stillCommand },
  { matches: ({ cmd }) => cmd === 'world', run: worldCommand },
  { matches: ({ cmd }) => cmd === 'sheet', run: sheetCommand },
  { matches: ({ cmd }) => cmd === 'looks', run: looksCommand },
  { matches: ({ cmd }) => cmd === 'review', run: review2Command },
  { matches: ({ cmd }) => cmd === 'qa', run: qaCommand },
  { matches: ({ cmd }) => cmd === 'beatmap', run: beatmap2Command },
  {
    matches: ({ cmd, o }) =>
      cmd === 'preview' && !!(o.beats || o.range || o.note || o.chapter),
    run: previewCommand,
  },
  {
    matches: ({ cmd }) => cmd === 'render' || cmd === 'preview',
    run: renderCommand,
  },
];
