import * as Schema from 'effect/Schema';
import {
  check,
  copy,
  type Teaching,
  type TeachingBase,
} from './teaching-common.mjs';
const decodeInput = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.Unknown),
);
function choice(p: Record<string, unknown>) {
  check(
    p.before == null && p.answer == null && p.after == null,
    'choice uses options and correctIndex',
  );
  check(
    Array.isArray(p.options) && p.options.length >= 2 && p.options.length <= 3,
    'choice needs 2–3 options',
  );
  const options = p.options.map((value, i) => copy(value, `options[${i}]`, 46));
  check(
    new Set(options.map((s) => s.trim().toLowerCase())).size === options.length,
    'options must be distinct',
  );
  check(
    typeof p.correctIndex === 'number' &&
      Number.isInteger(p.correctIndex) &&
      p.correctIndex >= 0 &&
      p.correctIndex < options.length,
    'correctIndex must select an option',
  );
  return { form: 'choice' as const, options, correctIndex: p.correctIndex };
}
export function teachingSpec(input: unknown, source?: string): Teaching {
  const p = decodeInput(input);
  const allowed = [
    'form',
    'phase',
    'prompt',
    'source',
    'layout',
    'motion',
    'revealAt',
    'explainAt',
    'options',
    'correctIndex',
    'before',
    'answer',
    'after',
    'explanation',
  ];
  for (const key of Object.keys(p))
    check(allowed.includes(key), `unknown field ${key}`);
  check(p.form === 'choice' || p.form === 'gap', 'form must be choice or gap');
  check(
    p.phase === 'question' || p.phase === 'answer',
    'phase must be question or answer',
  );
  const layout = p.layout ?? 'full',
    motion = p.motion ?? 'fade';
  check(
    layout === 'full' || layout === 'split',
    'layout must be full or split',
  );
  check(motion === 'fade' || motion === 'none', 'motion must be fade or none');
  const revealAt = p.revealAt ?? 0.25,
    explainAt = p.explainAt ?? 1.1;
  check(
    typeof revealAt === 'number' &&
      Number.isFinite(revealAt) &&
      revealAt >= 0 &&
      revealAt <= 2,
    'revealAt must be 0–2 seconds',
  );
  check(
    typeof explainAt === 'number' &&
      Number.isFinite(explainAt) &&
      explainAt >= revealAt &&
      explainAt <= 4,
    'explainAt must follow revealAt and be at most 4 seconds',
  );
  if (p.source != null && source != null)
    check(p.source === source, 'source conflicts with props.source');
  const base: TeachingBase = {
    phase: p.phase,
    prompt: copy(p.prompt, 'prompt', 100),
    explanation: copy(p.explanation, 'explanation', 130),
    source: copy(p.source ?? source, 'source', 160),
    layout,
    motion,
    revealAt,
    explainAt,
  };
  if (p.form === 'choice') return { ...base, ...choice(p) };
  check(
    p.options == null && p.correctIndex == null,
    'gap uses before, answer and after',
  );
  return {
    ...base,
    form: 'gap',
    before: copy(p.before, 'before', 70),
    answer: copy(p.answer, 'answer', 46),
    after: copy(p.after, 'after', 50, true),
  };
}
