import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('camera paths preserve authored holds, optics and arbitrary seek order', () => {
  const result = spawnSync('python3', ['-c', `
import sys, json, math, copy
sys.path.insert(0, 'scripts/blender')
import camera_rig as r
start={'location':[0,-8,4],'target':[0,0,1],'lens':50,'scale':10,'shift_x':0,'shift_y':.1,'focus':8,'fstop':2}
end={**start,'location':[2,-18,8],'target':[1,2,1],'lens':70,'focus':18,'fstop':8}
path=r.make_path(start,end,move=(.2,.8),dof=True)
assert r.path_at(path,0)==start and r.path_at(path,.2)==start
assert r.path_at(path,.8)==end and r.path_at(path,1)==end
middle=r.path_at(path,.5)
for k in ('lens','focus','fstop'):
 assert abs(middle[k]-(start[k]+end[k])/2)<1e-12
assert all(abs(a-b)<1e-12 for a,b in zip(middle['location'],[1,-13,6]))
assert all(abs(a-b)<1e-12 for a,b in zip(middle['target'],[.5,1,1]))
states=[r.path_at(path,i/1000) for i in range(1001)]
for i in range(1000,-1,-1):
 assert states[i]==r.path_at(json.loads(json.dumps(path)),i/1000)
assert all(s==start for s in states[:201])
assert all(s==end for s in states[800:])
for key in r.SCALARS:
 assert all(min(start[key],end[key])-1e-12<=s[key]<=max(start[key],end[key])+1e-12 for s in states)
bad=[]
for field,value in [('lens',0),('focus',-1),('fstop',float('nan')),('shift_x',3),('location',[0,False,2])]:
 p=copy.deepcopy(path);p['keys'][1][field]=value;bad.append(p)
p=copy.deepcopy(path);p['keys'][1]['phase']=0;bad.append(p)
p=copy.deepcopy(path);p['keys'][2]['target']=p['keys'][2]['location'];bad.append(p)
# Valid endpoint directions whose interpolated look crosses the vertical pole.
p=r.make_path(start,end);p['keys'][2]['location']=[0,8,4];p['keys'][2]['target']=[0,0,1];bad.append(p)
for p in bad:
 try:r.validate(p);raise AssertionError('invalid camera path accepted')
 except ValueError:pass
for phase in [-.1,1.01,float('nan'),True]:
 try:r.path_at(path,phase);raise AssertionError('invalid sample accepted')
 except ValueError:pass
print(json.dumps({'seekSamples':len(states),'invalidPathsRejected':len(bad)}))
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).seekSamples, 1001);
});
