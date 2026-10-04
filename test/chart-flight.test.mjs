import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('bounded chart targets retain legacy replay and avoid looking beyond the last observation',()=>{
 const result=spawnSync('python3',['-c',`
import sys,copy,math
sys.path.insert(0,'scripts/blender')
import camera_rig as rig
for count in range(2,13):
 args=dict(count=count,spacing=3,bar_width=1.15,bar_depth=.055,chart_height=5.95,amplitude=3.6,clearance=.18,aspect=16/9)
 legacy=rig.make_chart_flight(**args)
 bounded=rig.make_chart_flight(**args,target_policy='bounded-chart')
 assert legacy['version']==3 and 'target_policy' not in legacy
 assert bounded['version']==4 and bounded['target_policy']=='bounded-chart'
 for i in range(1001):
  old=rig.path_at(legacy,i/1000);new=rig.path_at(bounded,i/1000)
  assert old['location']==new['location'] and old['lens']==new['lens']
  assert 0<=new['target'][0]<=(count-1)*3
  assert math.hypot(new['target'][0]-new['location'][0],new['location'][1])>.001
  assert rig.path_at(copy.deepcopy(legacy),i/1000)==old
 if count==6:
  # Before the legacy turn begins, the old look-ahead exceeds the finite chart.
  old=rig.path_at(legacy,.45);new=rig.path_at(bounded,.45)
  assert old['target'][0]>15 and new['target'][0]==15
 for v in ['look-ahead','unknown',None]:
  bad=copy.deepcopy(bounded);bad['target_policy']=v
  try:rig.validate(bad);raise AssertionError('bad v4 target policy accepted')
  except ValueError:pass
 bad=copy.deepcopy(legacy);bad['target_policy']='bounded-chart'
 try:rig.validate(bad);raise AssertionError('v3 accepted extra field')
 except ValueError:pass
print('bounded and legacy contracts passed')
`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/contracts passed/);
});
