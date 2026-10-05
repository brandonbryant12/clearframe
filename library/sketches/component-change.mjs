// A component replaced in place: the old path is shown working, marked and removed, the new
// pieces arrive in its slot, and the same request takes the new route.
import { diagramElements } from '../../fframes/system-diagrams.mjs';
const diagram = {
  nodes: [
    { id: 'client', label: 'Client', kind: 'user' },
    { id: 'old', label: 'Inline worker' },
    { id: 'queue', label: 'Job queue', kind: 'queue' },
    { id: 'worker', label: 'Worker' },
  ],
  edges: [
    { from: 'client', to: 'old' },
    { from: 'client', to: 'queue', label: 'enqueue' },
    { from: 'queue', to: 'worker', flow: true },
  ],
  steps: [
    { at: 1.2, send: ['client', 'old'] },
    { at: 2.1, replace: 'old', with: 'queue' },
    { at: 3.2, add: 'worker' },
    { at: 4.3, send: ['client', 'queue', 'worker'] },
  ],
};
export default {
  name: 'component-change',
  summary: 'A component replaced in its own place, then the request takes the new route.',
  use: 'Pull requests that add, remove or replace a component.',
  diagram,
  build: (width, height) => ({ elements: diagramElements(diagram, { width, height }) }),
};
