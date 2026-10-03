import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { sculptureConfig } from '../engine/lib/sculptures.mjs';

test('reservoir levels conserve volume and tokens retain clearance throughout arbitrary phase seeks', () => {
  const r = spawnSync('python3', ['-c', `
import importlib.util, math, json
modules={}
for name in ['reservoir-transfer','conveyor-bypass']:
 spec=importlib.util.spec_from_file_location(name,'library/sculptures/'+name+'.py')
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);modules[name]=m
samples=[i/10000 for i in range(10001)]
minimum=100
expected={name:[m.state(p) for p in samples] for name,m in modules.items()}
for i in range(10000,-1,-1):
 p=samples[i];a=modules['reservoir-transfer'].state(p);b=modules['conveyor-bypass'].state(p)
 assert a==expected['reservoir-transfer'][i] and b==expected['conveyor-bypass'][i]
 assert abs(a['left']+a['right']-1.64)<1e-10 and min(a['left'],a['right'])>0
 if .28<p<.65: assert a['gate']==1
 if p>=.68: assert abs(a['left']-a['right'])<1e-10
 points=b['positions']; minimum=min(minimum,min(math.dist(x,y)for j,x in enumerate(points)for y in points[j+1:]))
 assert minimum>.54
 if .48<p<=1: assert b['gate']==1
assert modules['reservoir-transfer'].state(0)['left']==1.36
assert modules['reservoir-transfer'].state(1)['gate']==0
assert all(x>1.7 and abs(y-.7)<1e-10 for x,y in modules['conveyor-bypass'].state(1)['positions'])
print(json.dumps({'samples':len(samples),'minimum':minimum}))
`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.samples, 10001);
  assert.ok(result.minimum > .6);
  for (const id of ['reservoir-transfer', 'conveyor-bypass']) {
    const c = sculptureConfig(id);
    assert.equal(c.loop, false);
    assert.equal(c.frames, 192);
    assert.equal(c.motion.phases.at(-1).role, 'hold');
    assert.ok(c.motion.phases.at(-1).duration >= 1.5);
  }
});
