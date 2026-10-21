import type { MechanismEntry } from './contracts.mjs';
import { ICONS } from '../icons.mjs';

export const mechanisms6: MechanismEntry[] = [
  [
    'app',
    'An app screen (a window or a phone) drawn from what is on it: tabs, a panel that opens on its word, an upload slot a receipt photo lands in, fields that type in, a button that becomes its confirmation; its parts carry ids for the pointer.',
    'the step done in the app: a claim, a form, a request, a setting saved',
    'canvas app element with a pointer',
    'examples/fsa-deadline/README.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'app',
            id: 'hub',
            x: 800,
            y: 110,
            title: 'Kestrel Hub',
            tabs: ['Benefits', 'Claims'],
            heading: 'New claim',
            open: { say: 'Claims' },
            fields: [{ label: 'Amount', value: '$210.00', say: 'amount' }],
            button: { label: 'Submit', done: 'Claim sent', say: 'Submit' },
          },
          {
            type: 'pointer',
            steps: [
              { to: 'hub-tab-claims', say: 'Claims' },
              { to: 'hub-button', say: 'Submit' },
            ],
          },
        ],
      },
    },
  ],
  [
    'crumbs',
    'Where to go in an app as a row of chips joined by chevrons ("Leave › Family leave › New request"), each landing on its word, the last in the accent colour.',
    'the path to a form or a setting, said once, when drawing the whole app is too much; a close that repeats where to go',
    'canvas crumbs element',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'crumbs',
            x: 960,
            y: 520,
            anchor: 'middle',
            items: [
              { label: 'Leave', say: 'Leave' },
              { label: 'Family leave', say: 'Family' },
              { label: 'New request', say: 'request' },
            ],
          },
        ],
      },
    },
  ],
  [
    'icons',
    `A bundled icon set (${ICONS.length} Tabler icons) for canvas elements and cast tiles.`,
    'a recognisable thing in one glance',
    'canvas icon element, cast object icon',
    'film/icons.mjs',
    null,
  ],
];
