import ts from 'typescript';
import type {
  Contract,
  Parameters,
  Reference,
  Registry,
} from './contracts.mjs';
import { unsupported } from './errors.mjs';
import { defaultParameters, interfaceMembers, ownMembers } from './members.mjs';
import { renderObject } from './render-object.mjs';

const primitiveSchemas = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.StringKeyword, 'Schema.String'],
  [ts.SyntaxKind.NumberKeyword, 'Schema.Finite'],
  [ts.SyntaxKind.BooleanKeyword, 'Schema.Boolean'],
  [ts.SyntaxKind.UnknownKeyword, 'Schema.Unknown'],
  [ts.SyntaxKind.UndefinedKeyword, 'Schema.Undefined'],
]);

function argumentsOf(
  node: ts.TypeReferenceNode,
  count: number,
): readonly ts.TypeNode[] {
  if (node.typeArguments?.length !== count) {
    unsupported(node, `Expected ${count} type arguments.`);
  }
  return node.typeArguments;
}

function literal(node: ts.LiteralTypeNode): string {
  const value = node.literal;
  if (value.kind === ts.SyntaxKind.NullKeyword) return 'Schema.Null';
  if (
    ts.isStringLiteral(value) ||
    ts.isNumericLiteral(value) ||
    (ts.isPrefixUnaryExpression(value) &&
      value.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(value.operand)) ||
    value.kind === ts.SyntaxKind.TrueKeyword ||
    value.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return `Schema.Literal(${value.getText()})`;
  }
  return unsupported(node, 'Unsupported literal schema.');
}

export class TypeRenderer {
  constructor(
    readonly registry: Registry,
    readonly named: ReadonlySet<string>,
    readonly reference: Reference,
  ) {}

  contract(contract: Contract): string {
    const node = contract.node;
    if (ts.isInterfaceDeclaration(node)) {
      return renderObject(
        interfaceMembers(node, this.registry),
        (type, parameters) => this.render(type, parameters),
      );
    }
    return this.render(node.type, defaultParameters(node));
  }

  render(
    node: ts.TypeNode,
    parameters: Parameters = new Map(),
    trail: ReadonlySet<string> = new Set(),
  ): string {
    const primitive = primitiveSchemas.get(node.kind);
    if (primitive) return primitive;
    const render = (child: ts.TypeNode) =>
      this.render(child, parameters, trail);
    if (ts.isParenthesizedTypeNode(node)) return render(node.type);
    if (ts.isLiteralTypeNode(node)) return literal(node);
    if (ts.isUnionTypeNode(node)) {
      return `Schema.Union([${node.types.map(render).join(', ')}])`;
    }
    if (ts.isArrayTypeNode(node)) return this.array(render(node.elementType));
    if (ts.isTupleTypeNode(node)) {
      return `Schema.Tuple([${node.elements.map(render).join(', ')}]).pipe(Schema.mutable)`;
    }
    if (ts.isTypeLiteralNode(node)) {
      return renderObject(ownMembers(node.members, parameters), (type, scope) =>
        this.render(type, scope, trail),
      );
    }
    if (ts.isTypeReferenceNode(node))
      return this.typeReference(node, parameters, trail);
    return unsupported(
      node,
      `Unsupported schema type: ${ts.SyntaxKind[node.kind]}.`,
    );
  }

  private array(element: string): string {
    return `Schema.Array(${element}).pipe(Schema.mutable)`;
  }

  private partial(node: ts.TypeReferenceNode): string {
    const [argument] = argumentsOf(node, 1);
    if (
      !argument ||
      !ts.isTypeReferenceNode(argument) ||
      argument.typeArguments?.length
    ) {
      return unsupported(node, 'Partial requires a plain interface name.');
    }
    const contract = this.registry.contracts.get(argument.typeName.getText());
    if (!contract || !ts.isInterfaceDeclaration(contract.node)) {
      return unsupported(node, 'Partial requires a declared interface.');
    }
    return renderObject(
      interfaceMembers(contract.node, this.registry),
      (type, parameters) => this.render(type, parameters),
      true,
    );
  }

  private typeReference(
    node: ts.TypeReferenceNode,
    parameters: Parameters,
    trail: ReadonlySet<string>,
  ): string {
    const name = node.typeName.getText();
    const parameter = parameters.get(name);
    if (parameter) {
      if (trail.has(name)) unsupported(node, `Cyclic type parameter: ${name}.`);
      return this.render(parameter, parameters, new Set([...trail, name]));
    }
    if (name === 'Partial') return this.partial(node);
    if (name === 'Array') {
      const [element] = argumentsOf(node, 1);
      if (!element)
        return unsupported(node, 'Array requires its element type.');
      return this.array(this.render(element, parameters, trail));
    }
    if (name === 'Record') {
      const args = argumentsOf(node, 2);
      return `Schema.Record(${args.map((type) => this.render(type, parameters, trail)).join(', ')})`;
    }
    return this.contractReference(name, node, trail);
  }

  private contractReference(
    name: string,
    node: ts.TypeReferenceNode,
    trail: ReadonlySet<string>,
  ): string {
    if (node.typeArguments?.length) {
      unsupported(
        node,
        'Specialized generic contract schemas are not supported.',
      );
    }
    if (this.named.has(name)) return this.reference(name, node);
    const contract = this.registry.contracts.get(name);
    if (!contract || !ts.isTypeAliasDeclaration(contract.node)) {
      return unsupported(node, `Unknown schema contract: ${name}.`);
    }
    if (trail.has(name)) {
      return unsupported(node, `Recursive alias ${name} needs a named schema.`);
    }
    return this.render(
      contract.node.type,
      defaultParameters(contract.node),
      new Set([...trail, name]),
    );
  }
}
