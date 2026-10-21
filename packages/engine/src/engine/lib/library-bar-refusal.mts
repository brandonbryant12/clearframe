import path from 'node:path';

import { checkProject } from '../../film/prepare.mjs';

import { errorMessage } from './errors.mjs';
import { project } from './library-bar-media.mjs';
import type { BarRefusal, BarRefusalResult } from './library-bar-contracts.mjs';
export async function runRefusal(
  entry: BarRefusal,
  out: string,
  base: string,
): Promise<BarRefusalResult> {
  const root = path.join(out, entry.id);
  let errors;
  try {
    project(entry, root, base);
    errors = (await checkProject(root, { draft: true })).errors;
  } catch (e) {
    errors = [errorMessage(e)];
  }
  return {
    id: entry.id,
    status:
      errors.length && new RegExp(entry.match).test(errors.join('\n'))
        ? 'passed'
        : 'failed',
    expected: entry.match,
    errors,
  };
}
