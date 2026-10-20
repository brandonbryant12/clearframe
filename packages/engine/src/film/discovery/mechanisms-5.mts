import type { MechanismEntry } from './contracts.mjs';

export const mechanisms5: MechanismEntry[] = [
  [
    'marks',
    'Emphasis drawn on the words of a text element itself: a marker highlight, an underline, a ring, a box, a strike-through or a cross, each landing on its spoken word and moving with the text.',
    'pointing at the clause of a policy, the button to press, the old way struck out; a circle round a figure in a sentence',
    'canvas text marks',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'text',
            text: 'Unused money is forfeited at the end of the plan year.',
            x: 160,
            y: 540,
            size: 56,
            width: 1500,
            marks: [
              { words: 'forfeited', style: 'highlight', say: 'forfeited' },
            ],
          },
        ],
      },
    },
  ],
  [
    'document',
    'A page of real text (a policy, a plan summary, a client letter): sections laid out as they will be read, scrolled to the clause the voice names, its words marked.',
    'quoting a policy or plan document instead of paraphrasing it on a card; the clause that matters, highlighted',
    'canvas document element',
    'examples/fsa-deadline/README.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'document',
            x: 420,
            y: 60,
            w: 1080,
            h: 780,
            title: 'Travel & expense policy',
            sections: [
              {
                heading: 'Receipts',
                text: 'Itemised receipts are needed for anything over 25 dollars.',
              },
              {
                heading: 'Deadline',
                text: 'Submit within 30 days of the expense.',
              },
            ],
            scroll: [{ to: 'Deadline', say: 'thirty' }],
            marks: [
              { words: 'within 30 days', style: 'highlight', say: 'thirty' },
            ],
          },
        ],
      },
    },
  ],
  [
    'pointer',
    'A cursor (a fingertip on a tall frame) that goes to elements by id and presses them on their words: the step done in the app, following the controls when copy or layout change.',
    'how to do it in the app: open, choose, upload, submit',
    'canvas pointer element; give each control an id',
    'examples/fsa-deadline/README.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'group',
            id: 'submit',
            x: 1200,
            y: 760,
            children: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 360,
                h: 90,
                r: 20,
                fill: 'accent',
              },
              {
                type: 'text',
                text: 'Submit',
                x: 180,
                y: 58,
                size: 36,
                anchor: 'middle',
                fill: 'bg',
              },
            ],
          },
          { type: 'pointer', to: 'submit', say: 'Submit' },
        ],
      },
    },
  ],
  [
    'receipt',
    'A receipt drawn from its lines (merchant, items, tax; the total checked against them), or a card slip that is not one, on paper with a torn foot; its parts carry ids so marks ring its words and a pointer presses its total.',
    'expense, FSA and HSA claims: the receipt the claim needs, the slip that will not do, the total to enter',
    'canvas receipt element',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'receipt',
            id: 'lunch',
            x: 700,
            y: 120,
            merchant: 'Harbor Grill',
            detail: 'Mar 14, 2028',
            items: [
              { qty: 2, name: 'Crab cakes', price: 32 },
              { qty: 1, name: 'Iced tea', price: 4.5 },
            ],
            tax: 3.06,
            footer: 'Example',
            marks: [{ words: '$39.56', style: 'box', say: 'total' }],
          },
        ],
      },
    },
  ],
];
