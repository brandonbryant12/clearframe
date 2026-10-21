import ts from 'typescript';
import type {
  Declaration,
  Member,
  Parameters,
  Registry,
} from './contracts.mjs';
import { unsupported } from './errors.mjs';

export function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }
  return unsupported(name, 'Computed schema keys must be string literals.');
}

export function defaultParameters(node: Declaration): Parameters {
  const parameters = new Map<string, ts.TypeNode>();
  for (const parameter of node.typeParameters ?? []) {
    if (!parameter.default) {
      unsupported(parameter, 'Schema type parameters require a default.');
    }
    parameters.set(parameter.name.text, parameter.default);
  }
  return parameters;
}

export function ownMembers(
  nodes: readonly ts.TypeElement[],
  parameters: Parameters,
): Member[] {
  return nodes.map((node) => {
    if (
      !ts.isPropertySignature(node) &&
      !ts.isIndexSignatureDeclaration(node)
    ) {
      unsupported(
        node,
        `Unsupported object member: ${ts.SyntaxKind[node.kind]}.`,
      );
    }
    return { node, parameters };
  });
}

function baseMembers(
  node: ts.InterfaceDeclaration,
  registry: Registry,
  trail: ReadonlySet<string>,
): Member[] {
  const result: Member[] = [];
  for (const clause of node.heritageClauses ?? []) {
    for (const base of clause.types) {
      if (!ts.isIdentifier(base.expression) || base.typeArguments?.length) {
        unsupported(
          base,
          'Schema inheritance requires a plain interface name.',
        );
      }
      const contract = registry.contracts.get(base.expression.text);
      if (!contract || !ts.isInterfaceDeclaration(contract.node)) {
        unsupported(base, 'Schema inheritance requires a declared interface.');
      }
      result.push(...interfaceMembers(contract.node, registry, trail));
    }
  }
  return result;
}

/** Base fields keep their order; a derived declaration replaces an inherited field. */
export function interfaceMembers(
  node: ts.InterfaceDeclaration,
  registry: Registry,
  trail: ReadonlySet<string> = new Set(),
): Member[] {
  const name = node.name.text;
  if (trail.has(name))
    unsupported(node, `Cyclic interface inheritance: ${name}.`);
  const next = new Set([...trail, name]);
  const members = [
    ...baseMembers(node, registry, next),
    ...ownMembers(node.members, defaultParameters(node)),
  ];
  const properties = new Map<string, Member>();
  const indexes: Member[] = [];
  for (const member of members) {
    if (ts.isIndexSignatureDeclaration(member.node)) {
      indexes.push(member);
    } else {
      properties.set(propertyName(member.node.name), member);
    }
  }
  return [...properties.values(), ...indexes];
}
