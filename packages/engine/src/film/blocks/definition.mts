import type { BlockProps } from '../types.mjs';
export interface BlockDefinition {
  name: string;
  category: string;
  summary: string;
  props: Record<string, string>;
  example: BlockProps;
  tail: number;
  vo?: string;
}
export const common = {
  title: 'Scene headline',
  kicker: 'Short eyebrow',
  source: 'Visible attribution',
  land: 'Spoken word or local seconds',
  support: 'Supporting line',
};
export const emphasis = {
  emphasis: 'Up to 4 whole-word phrases drawn in the accent color',
};
export const emphasisStyle = {
  emphasisStyle:
    'accent or serif (italic Instrument Serif, the editorial accent). Unset, the film type voice decides: accent, italic, weight, marker or underline',
};
export const align = {
  align: 'left (default) or center: centre the whole stack',
};
export const sampleSource =
  'Illustrative sample data · replace before publishing';
export const b = (
  name: string,
  category: string,
  summary: string,
  props: Record<string, string>,
  example: BlockProps,
  extra: Partial<BlockDefinition> = {},
): BlockDefinition => ({
  name,
  category,
  summary,
  props: { ...common, ...props },
  example: { ...example, source: example.source ?? sampleSource },
  tail: 1.5,
  ...extra,
});
