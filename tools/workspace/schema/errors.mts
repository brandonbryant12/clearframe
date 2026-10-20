import type ts from 'typescript';

export function unsupported(node: ts.Node, reason: string): never {
  const source = node.getSourceFile();
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  throw new Error(
    `${source.fileName}:${position.line + 1}:${position.character + 1}: ${reason}`,
  );
}

export function requiredType(
  node: ts.PropertySignature | ts.IndexSignatureDeclaration,
): ts.TypeNode {
  if (!node.type) unsupported(node, 'Schema members require an explicit type.');
  return node.type;
}
