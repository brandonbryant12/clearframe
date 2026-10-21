import path from 'node:path';
import ts from 'typescript';
import type { GeneratedFile, Registry, SchemaBlock } from './contracts.mjs';
import { unsupported } from './errors.mjs';
import { loadSources } from './registry.mjs';
import { TypeRenderer } from './render.mjs';

function codecName(declaration: ts.VariableDeclaration): string | undefined {
  const identifier = declaration.name;
  if (!ts.isIdentifier(identifier) || !identifier.text.endsWith('Schema')) {
    return undefined;
  }
  const name = identifier.text.slice(0, -'Schema'.length);
  const annotation = declaration.type;
  if (
    !annotation ||
    !ts.isTypeReferenceNode(annotation) ||
    annotation.typeName.getText() !== 'Schema.Codec' ||
    annotation.typeArguments?.length !== 1 ||
    annotation.typeArguments[0]?.getText() !== name
  ) {
    unsupported(
      declaration,
      `External ${name}Schema must declare Schema.Codec<${name}>.`,
    );
  }
  return name;
}

function exportedCodecs(source: ts.SourceFile): string[] {
  const result: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (
      !statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      const name = codecName(declaration);
      if (name) result.push(name);
    }
  }
  return result;
}

export function externalSchemas(
  directory: string,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const source of loadSources(directory, 'canvas-schema')) {
    for (const name of exportedCodecs(source)) {
      if (result.has(name))
        throw new Error(`Duplicate external schema: ${name}.`);
      result.set(
        name,
        path.basename(source.fileName).replace(/\.mts$/, '.mjs'),
      );
    }
  }
  return result;
}

export function kebabName(name: string): string {
  return name.replace(
    /[A-Z]/g,
    (letter, index: number) => `${index ? '-' : ''}${letter.toLowerCase()}`,
  );
}

function sourceFor(
  block: SchemaBlock,
  external: ReadonlyMap<string, string>,
): string {
  const name = block.contract.name;
  const imports = new Map<string, string[]>();
  for (const reference of [...block.references].sort()) {
    if (reference === name) continue;
    const file = external.get(reference);
    const target = file ? `../${file}` : `./${kebabName(reference)}.mjs`;
    const names = imports.get(target) ?? [];
    names.push(`${reference}Schema`);
    imports.set(target, names);
  }
  const dependencies = [...imports].map(
    ([target, names]) => `import { ${names.join(', ')} } from '${target}';`,
  );
  return [
    "import * as Schema from 'effect/Schema';",
    `import type { ${name} } from '../contracts/${block.contract.group}.mjs';`,
    ...dependencies,
    '',
    `export const ${name}Schema: Schema.Codec<${name}> = Schema.suspend(() => ${block.expression});`,
    '',
  ].join('\n');
}

export function generateNative(
  registry: Registry,
  external: ReadonlyMap<string, string>,
): GeneratedFile[] {
  const blocks = new Map<string, SchemaBlock>();
  const building = new Set<string>();
  const named = new Set([...registry.contracts.keys(), ...external.keys()]);
  function build(name: string): void {
    if (blocks.has(name) || building.has(name) || external.has(name)) return;
    const contract = registry.contracts.get(name);
    if (!contract) throw new Error(`Missing native schema contract: ${name}.`);
    building.add(name);
    const references = new Set<string>();
    const renderer = new TypeRenderer(registry, named, (reference, node) => {
      if (!registry.contracts.has(reference) && !external.has(reference)) {
        unsupported(node, `Unknown native schema contract: ${reference}.`);
      }
      references.add(reference);
      build(reference);
      return `${reference}Schema`;
    });
    blocks.set(name, {
      contract,
      expression: renderer.contract(contract),
      references,
    });
    building.delete(name);
  }
  build('BlockProps');
  return [...blocks].map(([name, block]) => ({
    path: `film/props-schema/${kebabName(name)}.mts`,
    content: sourceFor(block, external),
  }));
}
