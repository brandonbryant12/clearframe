import ts from 'typescript';
import type { Member, Parameters } from './contracts.mjs';
import { propertyName } from './members.mjs';
import { requiredType, unsupported } from './errors.mjs';

export type RenderType = (node: ts.TypeNode, parameters: Parameters) => string;

function indexExpression(member: Member, render: RenderType): string {
  const node = member.node;
  if (!ts.isIndexSignatureDeclaration(node)) {
    return unsupported(node, 'Expected an index signature.');
  }
  const parameter = node.parameters[0];
  if (node.parameters.length !== 1 || !parameter?.type) {
    return unsupported(node, 'Index signatures require one typed string key.');
  }
  if (parameter.type.kind !== ts.SyntaxKind.StringKeyword) {
    return unsupported(
      parameter,
      'Only string index signatures are supported.',
    );
  }
  return `Schema.Record(Schema.String, ${render(requiredType(node), member.parameters)})`;
}

function fieldExpression(
  member: Member,
  render: RenderType,
  partial: boolean,
): string {
  const node = member.node;
  if (!ts.isPropertySignature(node)) {
    return unsupported(node, 'Expected a property signature.');
  }
  const schema = render(requiredType(node), member.parameters);
  const value =
    partial || node.questionToken ? `Schema.optional(${schema})` : schema;
  return `${JSON.stringify(propertyName(node.name))}: ${value}`;
}

export function renderObject(
  members: readonly Member[],
  render: RenderType,
  partial = false,
): string {
  const fields = members
    .filter((member) => ts.isPropertySignature(member.node))
    .map((member) => fieldExpression(member, render, partial));
  const indexes = members
    .filter((member) => ts.isIndexSignatureDeclaration(member.node))
    .map((member) => indexExpression(member, render));
  if (partial && indexes.length) {
    throw new Error('Partial index signatures are not supported.');
  }
  if (!fields.length && indexes.length === 1) {
    const index = indexes[0];
    if (index) return index;
  }
  const rest = indexes.length
    ? indexes
    : ['Schema.Record(Schema.String, Schema.Unknown)'];
  return `Schema.StructWithRest(Schema.Struct({\n${fields.join(',\n')}\n}), [${rest.join(', ')}])`;
}
