import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const ignored = new Set([
  '.cache',
  '.clearframe',
  '.DS_Store',
  '.git',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'target',
  'tsconfig.json',
  '__pycache__',
]);

interface CopyAssetOptions {
  omitDirectories?: readonly string[];
}

export function copyAssets(
  from: string,
  to: string,
  { omitDirectories = [] }: CopyAssetOptions = {},
): void {
  fs.cpSync(from, to, {
    recursive: true,
    filter: (file) => {
      const name = path.basename(file);
      if (ignored.has(name) || name === '.env' || name.startsWith('.env.'))
        return false;
      if (omitDirectories.includes(name) && fs.statSync(file).isDirectory())
        return false;
      return !/\.(?:mts|ts|map|pyc)$/.test(file);
    },
  });
}

export function compile(cwd: string, project: string, output: string): void {
  runCompiler(cwd, project, ['--outDir', output]);
}

export function check(cwd: string, project: string): void {
  runCompiler(cwd, project, ['--noEmit']);
}

function runCompiler(
  cwd: string,
  project: string,
  options: readonly string[],
): void {
  const compiler = path.join(workspace, 'node_modules/typescript-7/bin/tsc');
  const result = spawnSync(
    process.execPath,
    [compiler, '-p', project, ...options],
    {
      cwd,
      env: { ...process.env, GOMAXPROCS: '2' },
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${project} failed (${result.status}).`);
}

/** Keep the previous successful distribution intact until its replacement is complete. */
export function buildDistribution(
  directory: string,
  build: (staging: string) => void,
): void {
  const staging = fs.mkdtempSync(path.join(directory, '.dist-'));
  const output = path.join(directory, 'dist');
  const backup = path.join(directory, '.dist-previous');
  try {
    build(staging);
    fs.rmSync(backup, { recursive: true, force: true });
    if (fs.existsSync(output)) fs.renameSync(output, backup);
    try {
      fs.renameSync(staging, output);
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, output);
      throw error;
    }
    fs.rmSync(backup, { recursive: true, force: true });
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
