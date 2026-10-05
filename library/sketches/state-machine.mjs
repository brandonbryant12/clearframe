import { diagramElements } from '../../fframes/system-diagrams.mjs';
const diagram = {"nodes": [{"id": "idle", "label": "Idle", "kind": "state"}, {"id": "running", "label": "Running", "kind": "state", "status": "active"}, {"id": "done", "label": "Complete", "kind": "state"}], "edges": [{"from": "idle", "to": "running", "label": "start"}, {"from": "running", "to": "done", "label": "success", "at": 1.2}]};
export default { name: 'state-machine', summary: 'Native state machine with staged nodes and drawn connections.', use: 'Pull request explainers and technical walkthroughs.', build(width, height) {
  const d = structuredClone(diagram);
  if (height >= width) for (const n of d.nodes) if (n.x != null) [n.x, n.y] = [n.y, n.x];
  return { elements: diagramElements(d, { width, height }) };
} };
