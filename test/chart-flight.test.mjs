import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('chart flight clears full-height bars and ends on the complete chart in both formats', () => {
  const result = spawnSync('python3', ['-c', `
import sys, math, copy, json
sys.path.insert(0,'scripts/blender')
import camera_rig as rig
from chart_scene import chart_layout, chart_heights
checked=0
for count in range(2,13):
 for width,height in [(1920,1080),(1080,1920)]:
  values=[0 if i==0 else (i*17)%71 for i in range(count)]
  layout=chart_layout({'width':width,'height':height},values,[0,20,40,60,80])
  path=layout['path']; step=layout['spacing']; poses=[]
  for i in range(1001):
   phase=i/1000; pose=rig.path_at(path,phase); poses.append(pose)
   x,y,z=pose['location']; tx,ty,tz=pose['target']
   assert math.hypot(tx-x,ty-y)>1e-4
   for index in range(count):
    dx=max(abs(x-index*step)-path['bar_width']/2,0)
    dy=max(abs(y)-path['bar_depth']/2,0)
    assert math.hypot(dx,dy)>path['clearance']
   heights=chart_heights(phase,values,layout['unit'],path['phases'])
   assert all(0<=h<=v*layout['unit'] for h,v in zip(heights,values))
   checked+=1
  assert all(p==poses[0] for p in poses[:81])
  assert all(p==poses[-1] for p in poses[840:])
  for i in range(1000,-1,-37): assert poses[i]==rig.path_at(json.loads(json.dumps(path)),i/1000)
  end=poses[-1]; cx,cy,cz=end['location']; distance=-cy
  assert layout['stageRadius']>=distance+3
  # Project declared chart corners independently through the fixed horizontal
  # 36 mm sensor. A frontal endpoint must keep every corner inside its margin.
  for x in [-step/2,(count-.5)*step]:
   for z in [0,layout['height']]:
    px=.5+(x-cx)*end['lens']/(36*distance)
    py=.5+(z-cz)*end['lens']*width/(36*distance*height)
    assert path['margin']-1e-12<=px<=1-path['margin']+1e-12
    assert path['margin']-1e-12<=py<=1-path['margin']+1e-12
  assert chart_heights(1,values,layout['unit'],path['phases'])==[v*layout['unit'] for v in values]
  assert end['target']==[cx,0,cz] and end['lens']==48
base=chart_layout({'width':1920,'height':1080},[20,40],[0,20,40])['path']
for field,value in [('count',True),('count',13),('bar_width',3),('bar_depth',1),('amplitude',.5),('clearance',2),('aspect',float('nan')),('phases',[.2,.1,.9]),('dof',True),('unknown',0)]:
 bad=copy.deepcopy(base);bad[field]=value
 # A shallow chart can legitimately clear a 1-unit bar depth or .5 amplitude;
 # test these separately with deliberately insufficient geometry.
 if field=='bar_depth':bad['amplitude']=.5
 if field=='amplitude':bad['bar_width']=2.5
 try:rig.validate(bad);raise AssertionError('invalid chart contract accepted: '+field)
 except ValueError:pass
for values,ticks in [([1,True],[0,2]),([1,3],[0,2]),([1,2],[1,2]),([1,2],[0,2,1]),([1],[0,2])]:
 try:chart_layout({'width':1920,'height':1080},values,ticks);raise AssertionError('invalid data accepted')
 except ValueError:pass
print(checked)
`], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(Number(result.stdout.trim()), 22022);
});

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
