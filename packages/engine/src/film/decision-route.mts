import { check, answerAt } from './decision-common.mjs';
import type { DecisionNode, DecisionStep } from './decision-contracts.mjs';
/** The steps a case takes: each question with its answer, then the outcome. */
export function route(
  root: DecisionNode,
  answers: Record<string, string>,
  where: string,
): DecisionStep[] {
  const steps: DecisionStep[] = [];
  let node = root;
  while (node.ask !== undefined) {
    const value = answers[node.ask];
    check(
      value != null,
      `${where}.answers needs ${node.ask}: the rule asks it on this case's path`,
    );
    const answer = answerAt(value, `${where}.answers.${node.ask}`);
    steps.push({ ask: node.ask, answer });
    node = node[answer];
  }
  steps.push({ outcome: node.outcome });
  return steps;
}
