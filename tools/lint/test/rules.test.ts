import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

import { noChainedTypeAssertionsRule } from '../rules/no-chained-type-assertions.ts';
import { noKnownValueWideningRule } from '../rules/no-known-value-widening.ts';
import { noObjectParametersRule } from '../rules/no-object-parameters.ts';
import { noReflectApplyRule } from '../rules/no-reflect-apply.ts';
import { noReflectGetRule } from '../rules/no-reflect-get.ts';
import { noForbiddenTermInSymbolNamesRule } from '../rules/no-shape-in-symbol-names.ts';
import { noUnknownTypeAliasesRule } from '../rules/no-unknown-type-aliases.ts';
import { noWidenThenAssertRule } from '../rules/no-widen-then-assert.ts';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

tester.run(
  'clearframe/no-chained-type-assertions regression matrix',
  noChainedTypeAssertionsRule,
  {
    valid: [
      'const value = input as User;',
      'const values = [1, 2] as const;',
      'const user = (input) as User;',
      'const user = input satisfies User;',
    ],
    invalid: [
      {
        code: 'const value = input as object as User;',
        errors: [{ messageId: 'chained' }],
      },
      {
        code: 'const value = (input as unknown) as User;',
        errors: [{ messageId: 'chained' }],
      },
      {
        code: 'const value = <User><unknown>input;',
        errors: [{ messageId: 'chained' }],
      },
      {
        code: 'const value = ((input as unknown)) as User;',
        errors: [{ messageId: 'chained' }],
      },
    ],
  },
);

const knownValuePrelude =
  'type Command = () => void; const startCommand = () => {};';
const wideningError = { messageId: 'widening' } as const;

tester.run(
  'clearframe/no-known-value-widening regression matrix',
  noKnownValueWideningRule,
  {
    valid: [
      `${knownValuePrelude} const commands: Record<string, Command> = {};`,
      `${knownValuePrelude} type Index<T> = Record<string, T>; const commands: Index<Command> = {};`,
      `${knownValuePrelude} class Registry { commands: Record<string, Command> = {}; }`,
      `${knownValuePrelude} class Registry { accessor commands: Record<string, Command> = {}; }`,
      `${knownValuePrelude} let commands: Record<string, Command>; commands = {};`,
      `${knownValuePrelude} function create(): Record<string, Command> { return {}; }`,
      `${knownValuePrelude} const create = (): Record<string, Command> => ({});`,
      `${knownValuePrelude} const commands = {} as Record<string, Command>;`,
      `${knownValuePrelude} const commands = <Record<string, Command>>{};`,
      `${knownValuePrelude} const commands = { start: startCommand };`,
      `${knownValuePrelude} const commands = { start: startCommand } as const;`,
      `${knownValuePrelude} const commands = { start: startCommand } satisfies Record<string, Command>;`,
      `${knownValuePrelude} type Commands = Record<string, Command>; const commands = { start: startCommand } as const satisfies Commands;`,
      `${knownValuePrelude} type CommandName = 'start' | 'stop'; const commands: Record<CommandName, Command> = { start: startCommand, stop: startCommand };`,
      `${knownValuePrelude} type CommandName = 'start' | 'stop'; const commands: { readonly [Name in CommandName]: Command } = { start: startCommand, stop: startCommand };`,
      `${knownValuePrelude} const commands: { readonly start: Command } = { start: startCommand };`,
      `${knownValuePrelude} interface Commands { readonly start: Command } const commands: Commands = { start: startCommand };`,
      `${knownValuePrelude} type Commands = { readonly start: Command }; const commands: Commands = { start: startCommand };`,
      `${knownValuePrelude} type PermissionLevels = { readonly [Level in Permission]: number }; const levels: PermissionLevels = { admin: 1 };`,
      `${knownValuePrelude} function create() { return { start: startCommand }; }`,
      `${knownValuePrelude} function create(): { readonly start: Command } { return { start: startCommand }; }`,
      `${knownValuePrelude} interface Commands { readonly start: Command } function create(): Commands { return { start: startCommand }; }`,
      `${knownValuePrelude} declare function make(): Record<string, Command>; const commands: Record<string, Command> = make();`,
      `${knownValuePrelude} import { Commands } from './types'; const commands: Commands = { start: startCommand };`,
    ],
    invalid: [
      { code: 'const value: unknown = {};', errors: [wideningError] },
      { code: 'const value: object = {};', errors: [wideningError] },
      { code: 'let value: unknown; value = {};', errors: [wideningError] },
      {
        code: 'function create(): unknown { return {}; }',
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const commands: Record<string, Command> = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const commands: { [key: string]: Command } = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const commands: { [K in string]: Command } = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const commands = { start: startCommand } as Record<string, Command>;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const commands = ({ start: startCommand } as Record<string, Command>) as object;`,
        errors: 1,
      },
      {
        code: `${knownValuePrelude} class Registry { commands: Record<string, Command> = { start: startCommand }; }`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} let commands: Record<string, Command>; commands = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} function create(): Record<string, Command> { return { start: startCommand }; }`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} const source = { start: startCommand }; const commands: Record<string, Command> = source;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Open = Record<string, Command>; const source = { start: startCommand }; const commands: Open = source;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Open = { [key: string]: Command }; const source = { start: startCommand }; const commands: Open = source;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Open = { [key in string]: Command }; const source = { start: startCommand }; const commands: Open = source;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Open = Readonly<Record<string, Command>>; const source = { start: startCommand }; const commands: Open = source;`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Index<T> = Record<string, T>; const commands: Index<Command> = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Index<T> = Record<string, T>; type CommandsByName = Index<Command>; const commands: CommandsByName = { start: startCommand };`,
        errors: [wideningError],
      },
      {
        code: `${knownValuePrelude} type Index<T = Command> = Record<string, T>; const commands: Index = { start: startCommand };`,
        errors: [wideningError],
      },
      { code: 'const value: unknown = 1;', errors: [wideningError] },
      { code: 'const value: object = [];', errors: [wideningError] },
    ],
  },
);

const objectParameterError = { messageId: 'objectParameter' } as const;

tester.run(
  'clearframe/no-object-parameters regression matrix',
  noObjectParametersRule,
  {
    valid: [
      'type Alias = object;',
      'function f(value: Alias) {}',
      'interface Owner { readonly id: string } function f(value: Owner) {}',
      'function f<Value>(value: Value) {}',
      'function f<Value extends object>(value: Value) {}',
      'function f<Value extends Owner, Owner extends { readonly id: string }>(value: Value) {}',
      'type Owner = { readonly id: string }; function f<Value extends Owner>(value: Value) {}',
      'type Alias = object; function consume<Alias>(value: Alias) {}',
      'type Alias = object; type Consumer<Alias> = (value: Alias) => void;',
      'type Alias = object; interface Consumer<Alias> { consume(value: Alias): void }',
      'type Key = object; type Mapped<Input> = { [Key in keyof Input]: (value: Key) => void };',
      'type Item = object; type Unpacked<Input> = Input extends Promise<infer Item> ? (value: Item) => void : never;',
    ],
    invalid: [
      { code: 'function f(value: object) {}', errors: [objectParameterError] },
      {
        code: 'type Alias = object; function f(value: Alias) {}',
        errors: [objectParameterError],
      },
      {
        code: 'type Alias = (object); function f(value: Alias) {}',
        errors: [objectParameterError],
      },
      {
        code: 'type Item = object; type Fallback<Input> = Input extends infer Item ? string : (value: Item) => void;',
        errors: [objectParameterError],
      },
    ],
  },
);

tester.run(
  'clearframe/no-reflect-apply regression matrix',
  noReflectApplyRule,
  {
    valid: [
      'const value = operation.apply(owner, args);',
      'Reflect.get(owner, key);',
      'const Reflect = { apply() { return 1; } }; Reflect.apply();',
      'function invoke(Reflect: { apply(): number }) { return Reflect.apply(); }',
    ],
    invalid: [
      {
        code: 'const value = Reflect.apply(operation, owner, args);',
        errors: [{ messageId: 'reflectApply' }],
      },
      {
        code: "const value = Reflect['apply'](operation, owner, args);",
        errors: [{ messageId: 'reflectApply' }],
      },
    ],
  },
);

tester.run('clearframe/no-reflect-get regression matrix', noReflectGetRule, {
  valid: [
    'const value = owner.property;',
    'const value = owner[key];',
    'Reflect.set(owner, key, value);',
    'const Reflect = { get() { return 1; } }; Reflect.get();',
    'function read(Reflect: { get(): number }) { return Reflect.get(); }',
  ],
  invalid: [
    {
      name: 'static access',
      code: 'const value = Reflect.get(owner, key);',
      errors: [{ messageId: 'reflectGet' }],
    },
    {
      name: 'computed access',
      code: "const value = Reflect['get'](owner, key);",
      errors: [{ messageId: 'reflectGet' }],
    },
  ],
});

tester.run(
  'clearframe/no-shape-in-symbol-names owned-symbol matrix',
  noForbiddenTermInSymbolNamesRule,
  {
    valid: [
      'interface UserRecord { readonly id: string }',
      'const value = api.shape;',
      "const value = api['shape'];",
      "import { Shape as Geometry } from 'library';",
      'const { shape: geometry } = source;',
      'const value = { shape: 1 };',
    ],
    invalid: [
      {
        code: 'interface UserShape { readonly id: string }',
        errors: [{ messageId: 'forbiddenSymbolName' }],
      },
      {
        code: 'const userShape = source;',
        errors: [{ messageId: 'forbiddenSymbolName' }],
      },
      {
        code: 'const { shape } = source;',
        errors: [{ messageId: 'forbiddenSymbolName' }],
      },
      {
        code: 'function parseShape(shape: string) {}',
        errors: [
          { messageId: 'forbiddenSymbolName' },
          { messageId: 'forbiddenSymbolName' },
        ],
      },
      {
        code: "import { parse as ShapeParser } from 'library';",
        errors: [{ messageId: 'forbiddenSymbolName' }],
      },
      {
        code: 'class Owner { #cachedShape = 1; readShape() {} }',
        errors: [
          { messageId: 'forbiddenSymbolName' },
          { messageId: 'forbiddenSymbolName' },
        ],
      },
    ],
  },
);

tester.run(
  'clearframe/no-unknown-type-aliases regression matrix',
  noUnknownTypeAliasesRule,
  {
    valid: [
      'type User = { readonly id: string };',
      'type Alias = string; type UserId = Alias;',
    ],
    invalid: [
      {
        code: 'type Alias = unknown;',
        errors: [{ messageId: 'unknownAlias' }],
      },
      {
        code: 'type Current = unknown;',
        errors: [{ messageId: 'unknownAlias' }],
      },
      {
        code: 'type UnknownValue = unknown; type Alias = UnknownValue;',
        errors: [{ messageId: 'unknownAlias' }, { messageId: 'unknownAlias' }],
      },
    ],
  },
);

tester.run(
  'clearframe/no-widen-then-assert regression matrix',
  noWidenThenAssertRule,
  {
    valid: [
      "const source = { id: 'first' }; const widened: unknown = source;",
      'declare const input: unknown; const parsed = input as { readonly id: string };',
    ],
    invalid: [
      {
        code: "const source = { id: 'second' }; const widened: unknown = source; const parsed = widened as { readonly id: string };",
        errors: [{ messageId: 'widenThenAssert' }],
      },
    ],
  },
);
