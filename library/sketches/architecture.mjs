import { diagramElements } from '../../fframes/system-diagrams.mjs';
const diagram = {"nodes": [{"id": "user", "label": "User", "kind": "user"}, {"id": "api", "label": "API", "status": "active"}, {"id": "db", "label": "Database", "kind": "database"}], "edges": [{"from": "user", "to": "api", "label": "request"}, {"from": "api", "to": "db", "label": "query", "at": 1.1}]};
export default { name: 'architecture', summary: 'Native architecture with staged nodes and drawn connections.', use: 'Pull request explainers and technical walkthroughs.', build(width, height) {
  const d = structuredClone(diagram);
  if (height >= width) for (const n of d.nodes) if (n.x != null) [n.x, n.y] = [n.y, n.x];
  return { elements: diagramElements(d, { width, height }) };
} };
