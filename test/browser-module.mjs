import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const browser = fileURLToPath(
  new URL('../packages/engine/src/engine/ui/viewer/js/', import.meta.url),
);
const coreNames = [
  'store',
  'call',
  'esc',
  'plural',
  'markdown',
  'clock',
  'data',
];
const stubs = {
  './00-core.js': coreNames
    .map((name) => `export const ${name} = globalThis.${name};`)
    .join('\n'),
  './30-film.js': 'export const S = globalThis.S;',
  './agent-runtime.js': `
    export const currentSession = (session) => session === globalThis.S && !session.disposed;
    export const invalidate = () => {};
    export const notify = () => {};
    export const refreshAgent = () => {};
  `,
};

export async function browserPage() {
  const result = await build({
    entryPoints: [path.join(browser, '90-main.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  return result.outputFiles[0].text;
}

/** Bundle the real browser modules; replace only their page/network environment. */
export async function browserModule(exports) {
  const result = await build({
    stdin: {
      contents: exports,
      resolveDir: browser,
      sourcefile: 'test-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    globalName: 'subject',
    platform: 'browser',
    target: 'es2022',
    write: false,
    plugins: [
      {
        name: 'test-page-environment',
        setup(builder) {
          builder.onResolve({ filter: /^\.\// }, ({ path: name }) => {
            if (name in stubs) return { path: name, namespace: 'page' };
            if (name === './40-agent.js')
              return { path: path.join(browser, 'agent-outbox.ts') };
          });
          builder.onLoad(
            { filter: /.*/, namespace: 'page' },
            ({ path: name }) => ({
              contents: stubs[name],
              loader: 'js',
            }),
          );
        },
      },
    ],
  });
  return `${result.outputFiles[0].text}\nObject.assign(globalThis, subject);`;
}
