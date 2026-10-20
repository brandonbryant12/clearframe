import type { EditAuthor } from '../recording-model.mjs';

export const AGENT: EditAuthor = { role: 'agent' };

export interface ByOption {
  by?: EditAuthor;
}
