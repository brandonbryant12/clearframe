import fs from 'node:fs';
import path from 'node:path';
import { workspace, buildDistribution, compile } from './shared.mjs';

const cli = path.join(workspace, 'apps/cli');
const runtime = path.join(workspace, 'packages/engine/dist');
if (!fs.existsSync(path.join(runtime, 'engine/harness.mjs'))) {
  throw new Error('Build @repo/engine before assembling the CLI distribution.');
}
buildDistribution(cli, (staging) => {
  compile(cli, 'tsconfig.json', staging);
  fs.cpSync(runtime, path.join(staging, 'runtime'), {
    recursive: true,
    filter: (file) => !['.cache', 'node_modules'].includes(path.basename(file)),
  });
  const entry = path.join(staging, 'main.mjs');
  const original = fs.readFileSync(entry, 'utf8');
  const bundled = original.replace(
    /(['"])@repo\/engine\/cli\1/,
    "'./runtime/engine/cli.mjs'",
  );
  if (bundled === original)
    throw new Error('CLI entry did not import the engine.');
  fs.writeFileSync(entry, bundled);
  fs.chmodSync(entry, 0o755);
});
for (const name of ['LICENSE']) {
  fs.copyFileSync(path.join(workspace, name), path.join(cli, name));
}
