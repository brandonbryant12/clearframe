import type {
  DiagramSpec,
  DiagramOptions,
  DiagramState,
} from './contracts.mjs';
import { declareDiagram } from './declarations.mjs';
import { stepDiagram } from './steps.mjs';
import { resolveLifetimes } from './lifetimes.mjs';
export function diagramState(
  input: DiagramSpec,
  resolve: DiagramOptions['resolve'],
): DiagramState {
  const { N, E, pairs } = declareDiagram(input, resolve);
  const sends = stepDiagram(input, N, E, resolve);
  const exact = typeof resolve === 'function';
  return { ...resolveLifetimes(N, E, exact), pairs, sends, exact };
}
