import { execFileSync } from 'node:child_process';

import type { GitSidesInput, GitSides } from './contracts.mjs';

export function git(repo: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
}

/** Read `file` before and after `commit` (or `base`..`commit`) with the exact object ids. */
export function gitSides({
  repo,
  commit,
  base,
  file,
}: GitSidesInput): GitSides {
  const full = git(repo, [
    'rev-parse',
    '--verify',
    `${commit}^{commit}`,
  ]).trim();
  const from = git(repo, [
    'rev-parse',
    '--verify',
    `${base ?? `${full}^`}^{commit}`,
  ]).trim();
  const blob = (rev: string): string | null => {
    try {
      return git(repo, ['rev-parse', '--verify', `${rev}:${file}`]).trim();
    } catch {
      return null;
    }
  };
  const [oldBlob, newBlob] = [blob(from), blob(full)];
  if (!newBlob && !oldBlob)
    throw new Error(
      `${file} is in neither ${from.slice(0, 7)} nor ${full.slice(0, 7)}`,
    );
  const text = (b: string | null) =>
    b ? git(repo, ['cat-file', 'blob', b]) : '';
  return {
    commit: full,
    base: from,
    file,
    oldBlob,
    newBlob,
    before: text(oldBlob),
    after: text(newBlob),
  };
}
