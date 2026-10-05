// A state machine whose current state moves: transitions draw once, then the token and the
// highlighted state follow the story (including a failure and its retry).
import { diagramElements } from '../../fframes/system-diagrams.mjs';
const diagram = {
  nodes: [
    { id: 'idle', label: 'Queued', kind: 'state' },
    { id: 'running', label: 'Running', kind: 'state' },
    { id: 'failed', label: 'Failed', kind: 'state' },
    { id: 'done', label: 'Complete', kind: 'state' },
  ],
  edges: [
    { from: 'idle', to: 'running', label: 'start' },
    { from: 'running', to: 'done', label: 'success' },
    { from: 'running', to: 'failed', label: 'error' },
    { from: 'failed', to: 'running', label: 'retry' },
  ],
  steps: [
    { at: 1.4, send: ['idle', 'running'] },
    { at: 2.15, set: { running: 'active' } },
    { at: 2.5, send: ['running', 'failed'] },
    { at: 3.25, set: { running: 'neutral', failed: 'error' } },
    { at: 3.6, send: ['failed', 'running', 'done'] },
    { at: 5.1, set: { failed: 'neutral', done: 'added' } },
  ],};
export default {
  name: 'state-machine',
  summary: 'States and transitions; the current state travels, fails, retries and completes.',
  use: 'Lifecycles, job states, retries and approval flows.',
  diagram,
  build: (width, height) => ({ elements: diagramElements(diagram, { width, height }) }),
};
