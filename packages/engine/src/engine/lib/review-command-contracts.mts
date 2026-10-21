import type { CommandContext } from '../commands/options.mjs';
export type ReviewContext = Pick<
  CommandContext,
  'cmd' | 'dir' | 'o' | 'opts' | 'positionals'
>;
export type ReviewAuthor =
  | { role: 'agent'; name?: never }
  | { role: 'human'; name: string };
