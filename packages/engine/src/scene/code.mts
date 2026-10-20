export type {
  DiffOp,
  GitSidesInput,
  GitSides,
  CodeOptions,
} from './code/contracts.mjs';
export { highlight } from './code/tokens.mjs';
export { diffLines } from './code/diff.mjs';
export { gitSides } from './code/git.mjs';
export { codeElement } from './code/source.mjs';
export { CODE_MIN_SIZE, codeRows, fitCode } from './code-fit.mjs';
export type {
  CodeElement,
  CodeLine,
  CodeSpan,
  CodeStep,
  SpanRole,
} from './types.mjs';
