import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as Schema from 'effect/Schema';
import { workspace } from '../shared.mjs';
import type { Registry } from './contracts.mjs';
import { generateDomain } from './domain.mjs';
import { generateSchemas } from './generate.mjs';
import { externalSchemas, generateNative } from './native.mjs';
import {
  formatGenerated,
  changedGenerated,
  writeGenerated,
} from './output.mjs';
import { loadRegistry, registryFromSources } from './registry.mjs';

function registry(source: string): Registry {
  return registryFromSources([
    ts.createSourceFile('fixture.mts', source, ts.ScriptTarget.Latest, true),
  ]);
}

test('unsupported TypeScript nodes fail with a source location', () => {
  const unsupported = [
    'any',
    'never',
    '() => string',
    'string & { tag: string }',
    'typeof missing',
    '{ [K in "a"]: string }',
    'Missing["key"]',
    'Set<string>',
    '{ action(): void }',
    '{ [key: number]: string }',
  ];
  for (const type of unsupported) {
    assert.throws(
      () =>
        generateDomain(registry(`export interface Fixture { value: ${type} }`)),
      /fixture\.mts:1:\d+:/,
      `The generator must reject ${type}.`,
    );
  }
});

test('malformed source fails before a schema is generated', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-parse-'));
  try {
    await fs.writeFile(
      path.join(directory, 'broken.mts'),
      'export interface Broken { value: ; }',
    );
    assert.throws(() => loadRegistry(directory), /Type expected/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('inheritance is recursive and derived properties replace base fields', () => {
  const files = generateDomain(
    registry(`
    export interface Base { id: string; inherited: number }
    export interface Middle extends Base { middle: boolean }
    export interface Child extends Middle { id: "child"; leaf: string }
  `),
  );
  const source = files[0]?.content;
  assert.ok(source);
  const child = source.slice(source.indexOf('export const ChildSchema'));
  assert.equal(child.match(/"id":/g)?.length, 1);
  assert.match(child, /Schema\.Literal\("child"\)/);
  assert.match(child, /"inherited": Schema.Finite/);
  assert.match(child, /"middle": Schema.Boolean/);
  assert.match(child, /"leaf": Schema.String/);
});

test('generic defaults and Partial retain the concrete schema', () => {
  const files = generateDomain(
    registry(`
    export interface Props { title: string }
    export interface Generic<P extends Props = Props> { value: P }
    export interface Fixture { draft: Partial<Props> }
  `),
  );
  const source = files[0]?.content;
  assert.ok(source);
  assert.match(source, /"value": PropsSchema/);
  assert.match(source, /"title": Schema.optional\(Schema.String\)/);
  assert.throws(
    () => generateDomain(registry('export interface Generic<P> { value: P }')),
    /type parameters require a default/,
  );
});

test('native generation reuses exported canvas codecs and emits recursive props once', () => {
  const files = generateNative(
    registry(`
    export interface CanvasElement { type: string }
    export interface Child { next?: Child; element: CanvasElement }
    export interface BlockProps { child: Child }
  `),
    new Map([['CanvasElement', 'canvas-schema-canvas.mjs']]),
  );
  assert.equal(files.length, 2);
  const child = files.find((file) => file.path.endsWith('/child.mts'))?.content;
  assert.ok(child);
  assert.match(child, /from '\.\.\/canvas-schema-canvas.mjs'/);
  assert.match(child, /"next": Schema.optional\(ChildSchema\)/);
  assert.doesNotMatch(child, /import \{ ChildSchema \}/);
});

test('generated schemas decode recursive data, retain extras, and reject invalid nested values', async () => {
  const source = `
    export type JsonPrimitive = string | number | boolean | null;
    export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
    export interface Fixture {
      value: JsonValue;
      label?: string;
      child?: Fixture;
      point: [number, number];
      tags: string[];
    }
  `;
  // Keeping the temporary modules under the workspace gives ESM access to Effect.
  const directory = await fs.mkdtemp(path.join(workspace, '.schema-test-'));
  try {
    const files = await formatGenerated(generateDomain(registry(source)));
    await writeGenerated(directory, files);
    await fs.writeFile(
      path.join(directory, 'engine/contracts/fixture.mts'),
      source,
    );
    const module: unknown = await import(
      pathToFileURL(path.join(directory, 'engine/contracts/schema-fixture.mts'))
        .href
    );
    assert.ok(
      module && typeof module === 'object' && 'FixtureSchema' in module,
    );
    assert.ok(Schema.isSchema(module.FixtureSchema));
    const decode = Schema.decodeUnknownSync(
      Schema.toType(module.FixtureSchema),
    );
    const input = {
      value: { nested: [1, true, null] },
      label: undefined,
      point: [2, 3],
      tags: ['a'],
      extra: 9,
    };
    assert.deepEqual(decode(input), input);
    assert.throws(() => decode({ ...input, tags: [3] }));
    assert.throws(() => decode({ ...input, value: Infinity }));
    assert.throws(() => decode({ ...input, value: { invalid: undefined } }));
    assert.throws(() => decode({ ...input, child: { ...input, point: [2] } }));
    assert.deepEqual(await changedGenerated(directory, files), []);
    await fs.writeFile(path.join(directory, files[0]?.path ?? ''), '');
    assert.equal((await changedGenerated(directory, files)).length, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('current canonical contracts generate deterministically with canvas dependencies', async () => {
  const sourceRoot = path.join(workspace, 'packages/engine/src');
  const first = await formatGenerated(generateSchemas(sourceRoot));
  const second = await formatGenerated(generateSchemas(sourceRoot));
  assert.deepEqual(first, second);
  assert.ok(first.some((file) => file.path === 'engine/schemas.mts'));
  assert.ok(
    first.some((file) => file.path === 'film/props-schema/block-props.mts'),
  );
  assert.ok(
    externalSchemas(path.join(sourceRoot, 'film')).has('CanvasElement'),
  );
  for (const file of first) {
    assert.doesNotMatch(file.content, /\bSchema\.Any\b/);
  }
});
