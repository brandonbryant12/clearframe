export const FIELD_HINTS = {
  weight:
    'the weight is the font: font "bold", "semibold", "regular" or "light"',
  fontWeight:
    'the weight is the font: font "bold", "semibold", "regular" or "light"',
  fontFamily: 'font names a face: "display", "text", "serif", "mono", "hand"…',
  fontSize: 'use size (pixels)',
  align: 'text is placed by anchor: "start", "middle" or "end" at its x',
  textAlign: 'text is placed by anchor: "start", "middle" or "end" at its x',
  color: 'use fill with a palette token ("ink", "accent", "muted")',
  content: 'use text',
  label: 'a text element draws its words from text',
  icon: 'an icon element names its icon with name ("mail", "trash")',
};

export function fieldHint(key: string): string | undefined {
  const entry = Object.entries(FIELD_HINTS).find(([name]) => name === key);
  return entry?.[1];
}
