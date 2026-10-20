import {
  check,
  own,
  words,
  timing,
  ID,
  TONES,
  outcomeOf,
} from './decision-common.mjs';
import { decodeDecision } from './decision-schema.mjs';
import { route } from './decision-route.mjs';
import type {
  DecisionSpec,
  DecisionAsk,
  DecisionOutcome,
  DecisionCase,
  DecisionTree,
  DecisionNode,
} from './decision-contracts.mjs';
/** Validate a rule tree, its outcomes and the cases that walk it. */
export function decisionSpec(input: unknown): DecisionSpec {
  own(
    input,
    [
      'id',
      'title',
      'source',
      'asOf',
      'ask',
      'tree',
      'outcomes',
      'cases',
      'return',
    ],
    'decision',
  );
  const decoded = decodeDecision(input);
  const p = {
    ...decoded,
    id: decoded.id ?? 'decision',
    source: decoded.source ?? 'Example rule for illustration',
    ask: decoded.ask.map((q) => ({
      ...q,
      yes: q.yes ?? 'Yes',
      no: q.no ?? 'No',
    })),
    cases: decoded.cases.map((c, i): DecisionCase => {
      own(c, ['label', 'answers', 'say', 'cue', 'at', 'after'], `cases[${i}]`);
      return { ...c, path: [] };
    }),
  };
  check(
    typeof p.id === 'string' && ID.test(p.id),
    'id is a short lowercase name',
  );
  words(p.title, 'title', 70);
  p.source = words(p.source ?? 'Example rule for illustration', 'source', 110);
  check(
    Array.isArray(p.ask) && p.ask.length >= 1 && p.ask.length <= 4,
    'ask needs 1–4 questions: {id, label, yes?, no?}',
  );
  const asks = new Map<string, DecisionAsk>();
  p.ask.forEach((q, i) => {
    own(q, ['id', 'label', 'yes', 'no'], `ask[${i}]`);
    check(
      typeof q.id === 'string' && ID.test(q.id) && !asks.has(q.id),
      `ask[${i}].id is a unique short lowercase name`,
    );
    words(q.label, `ask[${i}].label`, 40);
    q.yes = words(q.yes ?? 'Yes', `ask[${i}].yes`, 14);
    q.no = words(q.no ?? 'No', `ask[${i}].no`, 14);
    asks.set(q.id, q);
  });
  check(
    Array.isArray(p.outcomes) &&
      p.outcomes.length >= 2 &&
      p.outcomes.length <= 5,
    'outcomes needs 2–5: {id, label, tone?}',
  );
  const outcomes = new Map<string, DecisionOutcome>();
  p.outcomes.forEach((o, i) => {
    own(o, ['id', 'label', 'tone'], `outcomes[${i}]`);
    check(
      typeof o.id === 'string' &&
        ID.test(o.id) &&
        !outcomes.has(o.id) &&
        !asks.has(o.id),
      `outcomes[${i}].id is a unique short lowercase name (not a question's)`,
    );
    words(o.label, `outcomes[${i}].label`, 40);
    check(
      o.tone == null || TONES.includes(o.tone),
      `outcomes[${i}].tone is ${TONES.join(', ')}`,
    );
    outcomes.set(o.id, o);
  });
  // The tree: {ask: ID, yes: subtree | outcome id, no: subtree | outcome id}; every question at most
  // once on any path, every outcome and every question reachable.
  const reached = new Set<string>(),
    used = new Set<string>();
  const walk = (
    node: DecisionTree,
    path: string[],
    where: string,
  ): DecisionNode => {
    if (typeof node === 'string') {
      check(
        outcomes.has(node),
        `${where} names "${node}", which is neither an outcome nor a question node`,
      );
      reached.add(node);
      return { outcome: node };
    }
    own(node, ['ask', 'yes', 'no'], where);
    check(
      asks.has(node.ask),
      `${where}.ask names a question (${[...asks.keys()].join(', ')})`,
    );
    check(
      !path.includes(node.ask),
      `${where} asks ${node.ask} again on the same path`,
    );
    used.add(node.ask);
    check(
      node.yes != null && node.no != null,
      `${where} needs both yes and no`,
    );
    return {
      ask: node.ask,
      yes: walk(node.yes, [...path, node.ask], `${where}.yes`),
      no: walk(node.no, [...path, node.ask], `${where}.no`),
    };
  };
  const root = walk(p.tree, [], 'tree');
  for (const o of outcomes.keys())
    check(reached.has(o), `outcome ${o} is never reached by the tree`);
  for (const q of asks.keys())
    check(used.has(q), `question ${q} is never asked by the tree`);
  check(
    Array.isArray(p.cases) && p.cases.length >= 1 && p.cases.length <= 2,
    'cases needs 1–2: the case, then optionally the same case with one answer changed (counterfactual)',
  );
  p.cases.forEach((c, i) => {
    words(c.label, `cases[${i}].label`, 48);
    own(c.answers, [...asks.keys()], `cases[${i}].answers`);
    for (const [k, v] of Object.entries(c.answers))
      check(
        v === 'yes' || v === 'no',
        `cases[${i}].answers.${k} is "yes" or "no"`,
      );
    timing(c, `cases[${i}]`);
    c.path = route(root, c.answers, `cases[${i}]`);
  });
  if (p.cases.length === 2) {
    const [a, b] = p.cases;
    const changed = [...asks.keys()].filter(
      (k) => (a.answers[k] ?? null) !== (b.answers[k] ?? null),
    );
    check(
      changed.length >= 1,
      'the counterfactual must change at least one answer',
    );
    check(
      outcomeOf(a) !== outcomeOf(b) ||
        a.path.length !== b.path.length ||
        a.path.some((s, k) => s.answer !== b.path[k]?.answer),
      'the counterfactual takes the same path to the same outcome; change an answer the rule actually asks',
    );
    b.changed = changed;
  }
  if (p.return != null) {
    own(p.return, ['say', 'cue', 'at', 'after'], 'return');
    timing(p.return, 'return');
    check(
      p.cases.length === 2,
      'return brings the first case back after a counterfactual: it needs two cases',
    );
  }
  return { ...p, root };
}
