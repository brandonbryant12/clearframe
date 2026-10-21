import fs from 'node:fs';
import path from 'node:path';

import { CRATE, FILM, sha256, REPO } from './paths.mjs';

export const walk = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(dir, e.name))
            : [path.join(dir, e.name)],
        )
    : [];

/** Everything compiled into the renderer: its sources, manifest, lockfile and the shared timing constants. */
export function sceneSources(): string[] {
  return [
    ...walk(path.join(CRATE, 'src')),
    path.join(CRATE, 'Cargo.toml'),
    path.join(CRATE, 'Cargo.lock'),
    path.join(FILM, 'constants.json'),
  ].sort();
}

/** The renderer's identity, recorded in manifests, receipts and revisions. */
export function sceneHash(): string {
  return sha256(
    Buffer.concat(
      sceneSources().map((f) =>
        Buffer.concat([
          Buffer.from(path.relative(REPO, f) + '\0'),
          fs.readFileSync(f),
        ]),
      ),
    ),
  );
}
