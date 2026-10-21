import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Contract, Registry } from './contracts.mjs';
import { unsupported } from './errors.mjs';

/** The compiler checks syntax without loading imports or typechecking the application. */
export function loadSources(directory: string, prefix = ''): ts.SourceFile[] {
  const names = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.mts') && !name.startsWith('schema-'))
    .filter((name) => name.startsWith(prefix))
    .sort()
    .map((name) => path.join(directory, name));
  const options: ts.CompilerOptions = { noResolve: true, noLib: true };
  const host = ts.createCompilerHost(options, true);
  const program = ts.createProgram(names, options, host);
  const diagnostics = program.getSyntacticDiagnostics();
  if (diagnostics.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => directory,
        getCanonicalFileName: (name) => name,
        getNewLine: () => '\n',
      }),
    );
  }
  return names.map((name) => {
    const source = program.getSourceFile(name);
    if (!source) throw new Error(`The compiler did not load ${name}.`);
    return source;
  });
}

export function registryFromSources(
  sources: readonly ts.SourceFile[],
): Registry {
  const contracts = new Map<string, Contract>();
  const groups = new Map<string, Contract[]>();
  for (const source of sources) {
    const group = path.basename(source.fileName, '.mts');
    const members: Contract[] = [];
    for (const node of source.statements) {
      if (
        !ts.isInterfaceDeclaration(node) &&
        !ts.isTypeAliasDeclaration(node)
      ) {
        continue;
      }
      const name = node.name.text;
      if (contracts.has(name)) {
        unsupported(node, `Duplicate contract name ${name}.`);
      }
      const contract = { name, group, node };
      contracts.set(name, contract);
      members.push(contract);
    }
    groups.set(group, members);
  }
  return { contracts, groups };
}

export function loadRegistry(directory: string): Registry {
  return registryFromSources(loadSources(directory));
}
