import { b, emphasis, align } from './definition.mjs';

export const chapterBlock = b(
  'chapter',
  'story',
  'A section opener: an oversized number, a rule that sweeps and the chapter title.',
  {
    number: 'Short marker such as 01 or II (≤ 4 characters)',
    text: 'Alias of title',
    ...emphasis,
    ...align,
  },
  {
    number: '01',
    title: 'Where the time goes',
    support: 'Three places a request waits.',
  },
);
