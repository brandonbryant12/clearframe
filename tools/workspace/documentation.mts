import fs from 'node:fs';
import path from 'node:path';

/** Resolve repository documentation references inside the self-contained runtime. */
export function prepareRuntimeDocumentation(runtime: string): void {
  const rewrite = (file: string, shallow: boolean): void => {
    let text = fs
      .readFileSync(file, 'utf8')
      .replaceAll('packages/engine/src/', '')
      .replaceAll('packages/engine/dist/', '')
      .replaceAll('apps/cli/dist/main.mjs', 'engine/cli.mjs')
      .replaceAll('pnpm cf', 'clearframe')
      .replace(/([\w/-]+)\.mts\b/g, '$1.mjs');
    if (shallow) text = text.replaceAll('../../../../', '../');
    fs.writeFileSync(file, text);
  };
  const visit = (
    directory: string,
    shallow: boolean,
    exampleScripts = false,
  ): void => {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory() && item.name !== 'research')
        visit(file, false, exampleScripts);
      else if (
        /\.(?:md|html)$/.test(item.name) ||
        (exampleScripts && item.name.endsWith('.mjs'))
      )
        rewrite(file, shallow);
    }
  };
  for (const directory of [
    'docs',
    'skills',
    'examples',
    'recipes',
    'templates',
  ])
    visit(
      path.join(runtime, directory),
      false,
      ['examples', 'recipes', 'templates'].includes(directory),
    );
  for (const directory of ['film', 'library'])
    visit(path.join(runtime, directory), true);
  rewrite(path.join(runtime, 'README.md'), false);
}
