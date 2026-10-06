// A request through a small service architecture: one declaration, one request travelling it.
// `clearframe sketch architecture` prints this diagram to adapt in canvas props.diagram.
import { diagramElements } from '../../film/system-diagrams.mjs';
const diagram = {
  nodes: [
    { id: 'user', label: 'User', kind: 'user' },
    { id: 'api', label: 'API' },
    { id: 'auth', label: 'Auth provider', kind: 'external' },
    { id: 'db', label: 'Database', kind: 'database' },
  ],
  edges: [
    { from: 'user', to: 'api', label: 'request' },
    { from: 'api', to: 'auth', label: 'verify', style: 'dashed' },
    { from: 'api', to: 'db', label: 'query' },
  ],
  steps: [
    { at: 1.6, send: ['user', 'api', 'db'], label: 'GET /orders' },
    { at: 3.1, set: { db: 'active' } },
  ],
};
export default {
  name: 'architecture',
  summary: 'Services, a user, an external dependency and a database; a request travels the path.',
  use: 'Pull request and system explainers: where a request goes, what it touches.',
  diagram,
  build: (width, height) => ({ elements: diagramElements(diagram, { width, height }) }),
};
