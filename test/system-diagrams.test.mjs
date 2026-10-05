import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProps } from '../fframes/catalog.mjs';
import { diagramElements } from '../fframes/system-diagrams.mjs';
import { sketch } from '../fframes/sketches.mjs';
import { normalizeElements } from '../fframes/canvas.mjs';
import { applyTreatment } from '../fframes/treatments.mjs';
const diagram = { nodes: [{ id: 'user', kind: 'user', label: 'User' }, { id: 'db', kind: 'database', label: 'Store', at: 1, exitAt: 3 }], edges: [{ from: 'user', to: 'db', at: 1.3, exitAt: 3 }] };
test('system diagrams compile to timed native shapes in every frame shape', () => {
  for (const [width, height] of [[1920,1080],[1080,1920],[1080,1080],[1080,1350]]) {
    const props = normalizeProps('canvas', { diagram }, { width, height });
    assert.equal(props.diagram, undefined);
    assert(props.elements.some(e => e.type === 'path' && e.enter === 'draw' && e.arrow === 'end'));
    const node = props.elements.find(e => e.id === 'diagram-node-db');
    assert.equal(node.at, 1); assert.equal(node.exitAt, 3);
    assert(node.children.some(e => e.type === 'ellipse' && e.fill === 'none'));
    assert.deepEqual(diagramElements(diagram, {width,height}), diagramElements(diagram, {width,height}));
  }
});
test('diagram references fail early and starter sketches validate in every aspect', () => {
  assert.throws(() => diagramElements({ ...diagram, edges: [{from:'user',to:'missing'}] }), /existing node/);
  assert.throws(() => diagramElements({nodes:[diagram.nodes[0],diagram.nodes[0]]}), /unique/);
  for (const name of ['architecture','state-machine','component-change']) for (const shape of ['landscape','vertical','square','portrait']) {
    const p = sketch(name, shape);
    assert(normalizeElements(p.elements).length > 0);
  }
});
test('business treatment locks the camera and preserves a deliberate authored move', () => {
  const sb = {beats:[{id:'a',block:'canvas',props:{}},{id:'b',block:'canvas',camera:'in',props:{}}]};
  applyTreatment(sb,'business');
  assert.equal(sb.lens.handheld,0); assert.equal(sb.beats[0].camera,'none'); assert.equal(sb.beats[1].camera,'in');
});
