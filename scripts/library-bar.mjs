#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { enterGate } from '../packages/engine/dist/engine/lib/resource-gate.mjs';
import { runLibraryBar } from '../packages/engine/dist/engine/lib/library-bar.mjs';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' } },
});
if (positionals.length !== 1)
  throw new Error(
    'Usage: node scripts/library-bar.mjs FIXTURE.json --out NEW-DIRECTORY',
  );
if (!(await enterGate())) {
  const result = await runLibraryBar(positionals[0], values);
  console.log(
    `Library bar ${result.status}: ${result.directory}/index.html (visual judgement remains open)`,
  );
  if (result.status !== 'passed') process.exitCode = 1;
}
