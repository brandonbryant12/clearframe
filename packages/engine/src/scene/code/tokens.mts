import type { CodeSpan, SpanRole } from '../types.mjs';

export const KEYWORDS = new Set(
  `fn let mut pub use mod struct enum impl trait for while loop if else match return break continue async await move ref self Self
  const static where type as in crate super dyn unsafe extern true false None Some Ok Err function var class extends new this
  import export from default try catch finally throw typeof instanceof delete void yield of interface implements private public
  protected readonly enum namespace def lambda with pass raise except elif and or not is None True False func package go defer
  chan select range nil struct map switch case`.split(/\s+/),
);

export type Rule = readonly [SpanRole | 'word' | 'space', RegExp];

export function wordRole(text: string, word: string, end: number): SpanRole {
  if (KEYWORDS.has(word)) return 'keyword';
  if (/^[A-Z]/.test(word)) return 'type';
  return text[end] === '(' ? 'function' : 'plain';
}

/** The first rule that matches a non-empty token at `i`, as a span. */
export function tokenAt(
  text: string,
  i: number,
  rules: readonly Rule[],
): CodeSpan | null {
  for (const [role, re] of rules) {
    re.lastIndex = i;
    const m = re.exec(text);
    if (!m || !m[0].length) continue;
    if (role === 'word')
      return { text: m[0], role: wordRole(text, m[0], i + m[0].length) };
    return { text: m[0], role: role === 'space' ? 'plain' : role };
  }
  return null;
}

/** Tokens of one line as spans with a colour role. */
export function highlight(text: string, lang = ''): CodeSpan[] {
  const comment = /^(py|sh|rb|yaml|yml|toml)$/.test(lang) ? /#.*/y : /\/\/.*/y;
  const rules: readonly Rule[] = [
    ['comment', comment],
    ['string', /"(?:[^"\\]|\\.)*"?/y],
    ['string', /'(?:[^'\\]|\\.)*'?/y],
    ['string', /`(?:[^`\\]|\\.)*`?/y],
    ['number', /\b\d[\d_]*(?:\.\d+)?\b/y],
    ['word', /[A-Za-z_][A-Za-z0-9_]*/y],
    ['space', /\s+/y],
    ['punctuation', /[^\sA-Za-z0-9_"'`]+/y],
  ];
  const spans: CodeSpan[] = [];
  let i = 0;
  while (i < text.length) {
    const token = tokenAt(text, i, rules);
    if (!token) {
      spans.push({ text: text[i], role: 'plain' });
      i++;
      continue;
    }
    const last = spans.at(-1);
    if (last && last.role === token.role) last.text += token.text;
    else spans.push(token);
    i += token.text.length;
  }
  return spans;
}
