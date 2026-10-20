import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from 'oxfmt';
import type { GeneratedFile } from './contracts.mjs';

export async function formatGenerated(
  files: readonly GeneratedFile[],
): Promise<GeneratedFile[]> {
  const result: GeneratedFile[] = [];
  // Keep formatter work bounded on small machines.
  for (const file of files) {
    const formatted = await format(file.path, file.content, {
      printWidth: 80,
      singleQuote: true,
    });
    if (formatted.errors.length) {
      throw new Error(
        `${file.path}: ${formatted.errors.map((error) => error.message).join('; ')}`,
      );
    }
    result.push({ ...file, content: formatted.code });
  }
  return result;
}

export async function writeGenerated(
  directory: string,
  files: readonly GeneratedFile[],
): Promise<void> {
  for (const file of files) {
    const target = path.join(directory, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
}

export async function changedGenerated(
  directory: string,
  files: readonly GeneratedFile[],
): Promise<string[]> {
  const changed: string[] = [];
  for (const file of files) {
    const existing = await fs
      .readFile(path.join(directory, file.path), 'utf8')
      .catch((error: unknown) => {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return null;
        throw error;
      });
    if (existing !== file.content) changed.push(file.path);
  }
  return changed;
}
