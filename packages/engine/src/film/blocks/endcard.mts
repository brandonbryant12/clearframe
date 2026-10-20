import { b, emphasis, emphasisStyle, align } from './definition.mjs';

export const endcardBlock = b(
  'endcard',
  'story',
  'A deliberate ending; the next step becomes a call-to-action pill.',
  {
    text: 'Final takeaway',
    action: 'Next step',
    ...emphasis,
    ...emphasisStyle,
    ...align,
  },
  {
    title: 'Make the next step smaller.',
    support: 'Start with one handoff this week.',
    action: 'Choose an owner. Measure the wait.',
  },
);
