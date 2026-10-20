import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('viewer assets resolve from an installation path containing URL escapes', async (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'clearframe install # 100% '),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = fs.realpathSync(directory);
  const module = path.join(root, 'engine/lib/viewer/media.mjs');
  fs.mkdirSync(path.dirname(module), { recursive: true });
  fs.copyFileSync(
    new URL(
      '../packages/engine/dist/engine/lib/viewer/media.mjs',
      import.meta.url,
    ),
    module,
  );
  fs.symlinkSync(
    fileURLToPath(new URL('../node_modules', import.meta.url)),
    path.join(root, 'node_modules'),
    'dir',
  );
  const ui = path.join(root, 'engine/ui/viewer');
  const fonts = path.join(root, 'film/assets/fonts');
  fs.mkdirSync(ui, { recursive: true });
  fs.mkdirSync(fonts, { recursive: true });
  fs.writeFileSync(path.join(ui, 'index.html'), 'viewer fixture');
  fs.writeFileSync(path.join(fonts, 'fixture.ttf'), 'font fixture');

  const media = await import(pathToFileURL(module).href);
  assert.equal(media.ROOT, root);
  assert.equal(
    fs.readFileSync(path.join(media.UI, 'index.html'), 'utf8'),
    'viewer fixture',
  );
  assert.equal(
    fs.readFileSync(path.join(media.FONT_DIR, 'fixture.ttf'), 'utf8'),
    'font fixture',
  );
});
