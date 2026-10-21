import ts from 'typescript';
import type { GeneratedFile, Registry, SchemaBlock } from './contracts.mjs';
import { TypeRenderer } from './render.mjs';

function blockSource(block: SchemaBlock): string {
  const name = block.contract.name;
  return `export const ${name}Schema: Schema.Codec<${name}> = Schema.suspend(() => ${block.expression});`;
}

function groupSource(
  group: string,
  blocks: readonly SchemaBlock[],
  registry: Registry,
): string {
  const imports = new Map<string, Set<string>>();
  for (const block of blocks) {
    for (const reference of block.references) {
      const owner = registry.contracts.get(reference)?.group;
      if (!owner || owner === group) continue;
      const names = imports.get(owner) ?? new Set<string>();
      names.add(`${reference}Schema`);
      imports.set(owner, names);
    }
  }
  const dependencies = [...imports].map(
    ([owner, names]) =>
      `import { ${[...names].sort().join(', ')} } from './schema-${owner}.mjs';`,
  );
  const names = blocks.map((block) => block.contract.name);
  const source = [
    "import * as Schema from 'effect/Schema';",
    `import type { ${names.join(', ')} } from './${group}.mjs';`,
    ...dependencies,
    '',
    ...blocks.map(blockSource),
  ];
  if (names.includes('Storyboard')) {
    source.push(
      'export const decodeStoryboard = Schema.decodeUnknownSync(StoryboardSchema);',
    );
  }
  if (names.includes('VoiceMetadata')) {
    source.push(
      'export const decodeVoiceMetadata = Schema.decodeUnknownSync(VoiceMetadataSchema);',
    );
  }
  return `${source.join('\n')}\n`;
}

/** ResolvedStoryboard is a post-validation model; its authored schema is Storyboard. */
export function generateDomain(registry: Registry): GeneratedFile[] {
  const selected = [...registry.contracts.values()].filter(
    (contract) =>
      contract.name === 'JsonValue' ||
      (ts.isInterfaceDeclaration(contract.node) &&
        contract.name !== 'ResolvedStoryboard'),
  );
  const named = new Set(selected.map((contract) => contract.name));
  const grouped = new Map<string, SchemaBlock[]>();
  for (const contract of selected) {
    const references = new Set<string>();
    const renderer = new TypeRenderer(registry, named, (name) => {
      references.add(name);
      return `${name}Schema`;
    });
    const block = {
      contract,
      expression: renderer.contract(contract),
      references,
    };
    const blocks = grouped.get(contract.group) ?? [];
    blocks.push(block);
    grouped.set(contract.group, blocks);
  }
  const files = [...grouped].map(([group, blocks]) => ({
    path: `engine/contracts/schema-${group}.mts`,
    content: groupSource(group, blocks, registry),
  }));
  files.push({
    path: 'engine/schemas.mts',
    content:
      [...grouped.keys()]
        .map((group) => `export * from './contracts/schema-${group}.mjs';`)
        .join('\n') + '\n',
  });
  return files;
}
