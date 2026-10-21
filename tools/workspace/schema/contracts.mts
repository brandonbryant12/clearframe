import type ts from 'typescript';

export type Declaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

export interface Contract {
  name: string;
  group: string;
  node: Declaration;
}

export interface Registry {
  contracts: ReadonlyMap<string, Contract>;
  groups: ReadonlyMap<string, readonly Contract[]>;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface SchemaBlock {
  contract: Contract;
  expression: string;
  references: ReadonlySet<string>;
}

export type Parameters = ReadonlyMap<string, ts.TypeNode>;

export interface Member {
  node: ts.PropertySignature | ts.IndexSignatureDeclaration;
  parameters: Parameters;
}

export type Reference = (name: string, node: ts.TypeReferenceNode) => string;
