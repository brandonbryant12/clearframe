import path from 'node:path';
import { parseArgs } from 'node:util';
import { workspace } from './shared.mjs';
import { generateSchemas } from './schema/generate.mjs';
import {
  changedGenerated,
  formatGenerated,
  writeGenerated,
} from './schema/output.mjs';

const { values, positionals } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    output: { type: 'string' },
  },
  allowPositionals: true,
  strict: true,
});
if (positionals.length > 1) {
  throw new Error(
    'Usage: schemas.mts [source-root] [--output directory] [--check]',
  );
}
const sourceRoot = path.resolve(
  positionals[0] ?? path.join(workspace, 'packages/engine/src'),
);
const outputRoot = path.resolve(values.output ?? sourceRoot);
const generated = await formatGenerated(generateSchemas(sourceRoot));
if (values.check) {
  const changed = await changedGenerated(outputRoot, generated);
  if (changed.length) {
    throw new Error(
      `Generated schemas are out of date:\n${changed.join('\n')}`,
    );
  }
  console.log(`Checked ${generated.length} generated schema files.`);
} else {
  await writeGenerated(outputRoot, generated);
  console.log(`Generated ${generated.length} schema files in ${outputRoot}.`);
}
