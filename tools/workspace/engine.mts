import fs from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { prepareRuntimeDocumentation } from './documentation.mjs';
import {
  workspace,
  buildDistribution,
  compile,
  copyAssets,
} from './shared.mjs';

const engine = path.join(workspace, 'packages/engine');
buildDistribution(engine, (staging) => {
  compile(engine, 'tsconfig.json', staging);
  compile(engine, 'tsconfig.browser.json', staging);
  copyAssets(path.join(engine, 'src'), staging);
  buildSync({
    entryPoints: [path.join(engine, 'src/engine/ui/viewer/js/90-main.ts')],
    outfile: path.join(staging, 'engine/ui/viewer/app.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
  });
  for (const item of ['docs', 'examples', 'recipes', 'templates', 'skills']) {
    const source = path.join(workspace, item);
    if (fs.existsSync(source))
      copyAssets(source, path.join(staging, item), {
        omitDirectories: ['examples', 'recipes', 'templates'].includes(item)
          ? ['assets', 'review']
          : [],
      });
  }
  for (const item of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
    fs.copyFileSync(path.join(workspace, item), path.join(staging, item));
  }
  // Handoffs retain the provenance of the bundled upstream native implementation.
  const provenance = 'archive/fframes/upstream.json';
  fs.mkdirSync(path.join(staging, 'archive/fframes'), { recursive: true });
  fs.copyFileSync(
    path.join(workspace, provenance),
    path.join(staging, provenance),
  );
  for (const name of ['make-episode.mjs', 'turns.txt']) {
    const relative = path.join('bench/enterprise/podcast', name);
    fs.mkdirSync(path.dirname(path.join(staging, relative)), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(workspace, relative),
      path.join(staging, relative),
    );
  }
  prepareRuntimeDocumentation(staging);
  fs.chmodSync(path.join(staging, 'engine/cli.mjs'), 0o755);
});
