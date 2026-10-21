import { b, emphasis } from './definition.mjs';

export const quoteBlock = b(
  'quote',
  'story',
  'A sourced human voice in light display type with an oversized mark.',
  { text: 'Quotation', author: 'Attribution', role: 'Context', ...emphasis },
  {
    text: 'The best handoff is the one nobody has to chase.',
    author: 'Illustrative interview',
    role: 'Fictional quotation for this template',
  },
);
