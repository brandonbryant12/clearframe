import { defineRule } from '@oxlint/plugins';
import type { ESTree } from '@oxlint/plugins';

const FORBIDDEN_SYMBOL_NAME = 'shape';

function containsForbiddenSymbolName(name: string): boolean {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

type NamedSymbol =
  | ESTree.BindingIdentifier
  | ESTree.IdentifierName
  | ESTree.PrivateIdentifier;
type ReportSymbol = (node: NamedSymbol) => void;

function reportBindingNames(
  pattern: ESTree.BindingPattern | ESTree.ParamPattern,
  report: ReportSymbol,
): void {
  switch (pattern.type) {
    case 'Identifier':
      report(pattern);
      return;
    case 'AssignmentPattern':
      reportBindingNames(pattern.left, report);
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) reportBindingNames(element, report);
      }
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        if (property.type === 'RestElement') {
          reportBindingNames(property.argument, report);
          continue;
        }
        reportBindingNames(property.value, report);
      }
      return;
    case 'RestElement':
      reportBindingNames(pattern.argument, report);
      return;
    case 'TSParameterProperty':
      reportBindingNames(pattern.parameter, report);
  }
}

function reportPropertyKey(
  key: ESTree.PropertyKey,
  computed: boolean,
  report: ReportSymbol,
): void {
  if (
    !computed &&
    (key.type === 'Identifier' || key.type === 'PrivateIdentifier')
  ) {
    report(key);
  }
}

/** Ban "shape" in declarations owned by this repository while allowing external API names. */
export const noForbiddenTermInSymbolNamesRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in locally owned bindings and declarations.',
    },
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
  },
  createOnce(context) {
    const reportForbiddenSymbolName: ReportSymbol = (node) => {
      if (!containsForbiddenSymbolName(node.name)) return;
      context.report({
        node,
        messageId: 'forbiddenSymbolName',
        data: { name: node.name },
      });
    };

    const checkFunction = (node: ESTree.Function): void => {
      if (node.id) reportForbiddenSymbolName(node.id);
      for (const parameter of node.params) {
        reportBindingNames(parameter, reportForbiddenSymbolName);
      }
    };

    const checkClass = (node: ESTree.Class): void => {
      if (node.id) reportForbiddenSymbolName(node.id);
    };

    const checkMethod = (node: ESTree.MethodDefinition): void => {
      reportPropertyKey(node.key, node.computed, reportForbiddenSymbolName);
    };

    const checkProperty = (node: ESTree.PropertyDefinition): void => {
      reportPropertyKey(node.key, node.computed, reportForbiddenSymbolName);
    };

    const checkAccessor = (node: ESTree.AccessorProperty): void => {
      reportPropertyKey(node.key, node.computed, reportForbiddenSymbolName);
    };

    return {
      VariableDeclarator(node) {
        reportBindingNames(node.id, reportForbiddenSymbolName);
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      TSEmptyBodyFunctionExpression: checkFunction,
      ArrowFunctionExpression(node) {
        for (const parameter of node.params) {
          reportBindingNames(parameter, reportForbiddenSymbolName);
        }
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      ImportSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      ImportDefaultSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      ImportNamespaceSpecifier(node) {
        reportForbiddenSymbolName(node.local);
      },
      CatchClause(node) {
        if (node.param)
          reportBindingNames(node.param, reportForbiddenSymbolName);
      },
      TSTypeAliasDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSInterfaceDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSEnumDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSEnumMember(node) {
        if (node.id.type === 'Identifier') reportForbiddenSymbolName(node.id);
      },
      TSModuleDeclaration(node) {
        if (node.id.type === 'Identifier') reportForbiddenSymbolName(node.id);
      },
      TSImportEqualsDeclaration(node) {
        reportForbiddenSymbolName(node.id);
      },
      TSTypeParameter(node) {
        reportForbiddenSymbolName(node.name);
      },
      TSMappedType(node) {
        reportForbiddenSymbolName(node.key);
      },
      MethodDefinition: checkMethod,
      TSAbstractMethodDefinition: checkMethod,
      PropertyDefinition: checkProperty,
      TSAbstractPropertyDefinition: checkProperty,
      AccessorProperty: checkAccessor,
      TSAbstractAccessorProperty: checkAccessor,
      TSPropertySignature(node) {
        reportPropertyKey(node.key, node.computed, reportForbiddenSymbolName);
      },
      TSMethodSignature(node) {
        reportPropertyKey(node.key, node.computed, reportForbiddenSymbolName);
      },
    };
  },
});
