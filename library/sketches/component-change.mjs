import { diagramElements } from '../../fframes/system-diagrams.mjs';
const diagram = {"nodes": [{"id": "client", "label": "Client", "kind": "user", "x": 0, "y": 0.5}, {"id": "old", "label": "Old worker", "status": "removed", "x": 0.5, "y": 0.5, "exitAt": 2}, {"id": "queue", "label": "Queue", "kind": "queue", "status": "added", "x": 0.5, "y": 0.5, "at": 2.5}, {"id": "worker", "label": "Worker", "status": "added", "x": 1, "y": 0.5, "at": 3}], "edges": [{"from": "client", "to": "old", "status": "removed", "exitAt": 2}, {"from": "client", "to": "queue", "status": "added", "at": 2.8}, {"from": "queue", "to": "worker", "status": "added", "at": 3.3}]};
export default { name: 'component-change', summary: 'Native component change with staged nodes and drawn connections.', use: 'Pull request explainers and technical walkthroughs.', build(width, height) {
  const d = structuredClone(diagram);
  if (height >= width) for (const n of d.nodes) if (n.x != null) [n.x, n.y] = [n.y, n.x];
  return { elements: diagramElements(d, { width, height }) };
} };
