import path from 'node:path';
import type { GeneratedFile } from './contracts.mjs';
import { generateDomain } from './domain.mjs';
import { externalSchemas, generateNative } from './native.mjs';
import { loadRegistry } from './registry.mjs';

export function generateSchemas(sourceRoot: string): GeneratedFile[] {
  const engine = loadRegistry(path.join(sourceRoot, 'engine/contracts'));
  const film = loadRegistry(path.join(sourceRoot, 'film/contracts'));
  const external = externalSchemas(path.join(sourceRoot, 'film'));
  return [...generateDomain(engine), ...generateNative(film, external)].sort(
    (left, right) => left.path.localeCompare(right.path),
  );
}
