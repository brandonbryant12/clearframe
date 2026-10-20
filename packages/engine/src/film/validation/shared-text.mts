import type { BlockProps, PropHelpers } from '../types.mjs';

function textLimit(key: string, name: string): number {
  if (key === 'text') return name === 'highlight' ? 200 : 240;
  return key === 'title' ? 90 : 160;
}

export function validateSharedText(
  name: string,
  p: BlockProps,
  h: PropHelpers,
): void {
  const fail = h.fail;
  for (const key of [
    'title',
    'kicker',
    'source',
    'support',
    'text',
    'label',
    'context',
    'caption',
    'author',
    'role',
    'verdict',
    'expression',
    'result',
    'explanation',
    'action',
  ])
    h.text(
      Object.entries(p).find(([field]) => field === key)?.[1],
      key,
      textLimit(key, name),
    );
  h.text(p.number, 'number', 4);
  h.text(p.center, 'center', 30);
  if (name === 'chapter' && p.text != null) {
    if (p.title != null) fail('use title or text, not both');
    p.title = p.text;
    delete p.text;
  }
  if (
    ['title', 'statement', 'endcard'].includes(name) &&
    p.text != null &&
    p.title != null
  )
    fail('use text or title, not both');
  if (name === 'highlight' && p.title != null)
    fail(
      'highlight shows its text only; put a heading in kicker or a separate beat',
    );
  if (name === 'stat' && p.context != null && p.support != null)
    fail('use context or support, not both');
}

export function validateEmphasis(
  name: string,
  p: BlockProps,
  h: PropHelpers,
): void {
  const fail = h.fail;
  if (name === 'kinetic') return;

  if (p.align != null && !['left', 'center'].includes(p.align))
    fail('align must be left or center');
  if (p.emphasisStyle != null) {
    if (!['accent', 'serif'].includes(p.emphasisStyle))
      fail('emphasisStyle must be accent or serif');
    if (!p.emphasis) fail('emphasisStyle needs emphasis phrases');
  }
  if (p.emphasis != null) {
    if (
      !Array.isArray(p.emphasis) ||
      p.emphasis.length < 1 ||
      p.emphasis.length > 4
    )
      fail('emphasis needs 1–4 phrases');
    p.emphasis.forEach((e) => {
      h.text(e, 'emphasis', 60);
      if (h.findPhrase(p.text ?? p.title, e) < 0)
        fail(`emphasis "${e}" must be whole words from the text`);
    });
  }
}
