import type { MechanismEntry } from './contracts.mjs';

export const mechanisms1: MechanismEntry[] = [
  [
    'cast',
    'Persistent objects that carry a story across cuts: they gather, queue, rank, travel, merge, split, swap one thing for another and hand the frame to the next scene.',
    'a process, a flow of requests, a before/after, a journey, the same objects regrouped into a new arrangement (sorted, ranked, merged, split), anything with actors that change',
    'canvas props.cast',
    'docs/cast.md',
    {
      block: 'canvas',
      props: {
        cast: {
          look: 'drawn',
          objects: [
            { id: 'a', shape: 'ticket', color: 'accent' },
            { id: 'b', shape: 'person', color: 'surface' },
          ],
          formations: [
            { form: 'line', at: 0 },
            { form: 'travel', ids: ['a'], to: 'b', say: 'reaches' },
          ],
        },
      },
    },
  ],
  [
    'stage',
    'A native GPU stage: actors with stable identities, links that follow them, packets, callouts, commit-grounded code, footage, materials, particles and a 2.5D camera.',
    'systems that change over time, technical and PR explainers, architecture',
    'block stage, or film stages',
    'docs/scene-engine.md',
    {
      block: 'stage',
      props: {
        actors: [
          { id: 'app', label: 'App', kind: 'client', x: 460, y: 600, at: 0.2 },
          {
            id: 'api',
            label: 'API',
            kind: 'service',
            x: 1060,
            y: 600,
            at: 0.4,
          },
          {
            id: 'db',
            label: 'Database',
            kind: 'database',
            x: 1560,
            y: 600,
            at: 0.6,
          },
        ],
        links: [
          { id: 'app-api', from: 'app', to: 'api' },
          { id: 'api-db', from: 'api', to: 'db' },
        ],
        events: [
          { do: 'send', from: 'app', to: 'api', label: 'request', say: 'asks' },
          { do: 'state', actor: 'api', status: 'active', say: 'checks' },
          { do: 'send', from: 'api', to: 'db', say: 'reads' },
        ],
      },
    },
  ],
  [
    'code-scene',
    'A code change as one scene: a stage holding only code makes the editor the picture, changed lines lighting up on a spoken word; long lines wrap readably on phones.',
    'a pull request, a fix, a before/after in code',
    'block stage, props.code',
    'docs/scene-engine.md',
    {
      block: 'stage',
      props: {
        code: {
          title: 'parser.mjs',
          before: 'if (x) return;',
          after: 'if (x == null) return;',
          say: 'null',
        },
      },
    },
  ],
  [
    'diagram',
    'A system diagram that lays itself out for the frame: components, ranks and flows, editable by id.',
    'architecture, how parts connect, data paths',
    'canvas props.diagram; sketch architecture | state-machine | component-change prints one to edit',
    'docs/system-diagrams.md',
    { block: 'canvas', props: { sketch: 'architecture' } },
  ],
];
