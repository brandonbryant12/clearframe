import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {phaseTrail} from '../film/phase-data.mjs';
import {phaseScene,phaseValue} from '../film/phases.mjs';
const inputs=JSON.parse(fs.readFileSync(new URL('../test/fixtures/phase-inputs.json',import.meta.url)));
const sample=i=>{const{id,...data}=structuredClone(inputs.cases[i]);return data;};

test('phase quadrants preserve exact reference boundaries, chronology and missing pairs',()=>{
 const a=phaseTrail(sample(0));assert.deepEqual(a.points.map(p=>p.quadrant),['SW','SW','SE','NE','NE','NW','NW',null,null]);assert.equal(a.points[8].boundary,'x-reference');assert.deepEqual(a.points[7].missing,['y']);assert.equal(a.observed,8);assert.equal(a.missing,1);assert.deepEqual(a.segments.map(s=>[s.from,s.to]),[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]);
 const b=phaseTrail(sample(1));assert.equal(b.focus.boundary,'both-references');assert.equal(b.focus.quadrant,null);assert.equal(b.points[1].time,.1);assert.equal(b.points[3].time,.4);assert.deepEqual(b.points[6].missing,['x']);assert.deepEqual(b.segments.map(s=>[s.from,s.to]),[[0,1],[1,2],[2,3],[3,4],[7,8]]);
});
test('phase input rejects sparse or invented observations, ambiguous scales and future dates',()=>{
 for(const mutate of [d=>delete d.points[1],d=>d.points[1].date=d.points[0].date,d=>d.points[0].x=undefined,d=>d.points[0].x=5,d=>d.points[0].x=NaN,d=>d.points[1].date='2026-02-30',d=>d.points.at(-1).date='2026-10-01',d=>d.smoothing='spline',d=>d.x.reference=-4,d=>d.x.reference=.5,d=>d.x.ticks=[-4,0,0,4],d=>delete d.x.domain[0],d=>d.focusDate='2026-02-01',d=>d.points.forEach(p=>p.x=null),d=>d.quadrants.NE=d.quadrants.NW]){const d=sample(0);mutate(d);assert.throws(()=>phaseTrail(d));}
});
test('phase input remains immutable and rounded values are explicitly approximate',()=>{
 const d=sample(0),before=JSON.stringify(d),r=phaseTrail(d);assert.equal(JSON.stringify(d),before);r.x.domain[0]=-99;r.points[0].x=99;assert.equal(JSON.stringify(d),before);assert.equal(phaseValue(-.004,2),'≈0.00');assert.equal(phaseValue(1.25,2),'1.25');assert.equal(phaseValue(null,2),'missing');
});
test('phase native markers map both axes and calendar time without closing gaps or interpolating states',()=>{
 for(let i=0;i<2;i++)for(const [w,h]of [[1920,1080],[1080,1920]]){
  const d=sample(i),s=phaseScene(d,{width:w,height:h,id:'trail',reveal:true}),[l,t,r,b]=s.geometry.box,e=s.props.elements;
  for(const p of s.geometry.points){if(!p.valid){assert.equal(p.point,null);assert.equal(e.some(x=>x.id===`trail-point-${p.index}`),false);continue;}const mark=e.find(x=>x.id===`trail-point-${p.index}`);assert.ok(Math.abs(mark.cx-(l+(p.x-d.x.domain[0])/(d.x.domain[1]-d.x.domain[0])*(r-l)))<1e-9);assert.ok(Math.abs(mark.cy-(b-(p.y-d.y.domain[0])/(d.y.domain[1]-d.y.domain[0])*(b-t)))<1e-9);assert.equal(mark.at,1+12*p.time);assert.equal(mark.along,undefined);}
  assert.equal(s.geometry.labels.length,4);assert.equal(s.geometry.segments.length,i===0?6:5);for(const p of s.geometry.segments){const mark=e.find(x=>x.id===`trail-segment-${p.to}`);assert.equal(mark.drawEase,'linear');assert.equal(mark.dur,p.end-p.at);}
  assert.ok(e.findIndex(x=>x.id==='trail-point-0')>e.findLastIndex(x=>x.type==='line'&&x.id.includes('-segment-')));
  const focus=phaseScene(d,{width:w,height:h,id:'focus',view:'focus'});assert.match(focus.props.elements.find(x=>x.id==='focus-focus-values').text,new RegExp(d.focusDate));assert.equal(focus.props.elements.find(x=>x.id==='focus-selected').fill,'none');
 }
});
test('phase layouts reject unsupported density and impossible label placement',()=>{
 const d=sample(0);assert.throws(()=>phaseScene(d,{width:400,height:400,id:'bad'}));assert.throws(()=>phaseScene(d,{width:1920,height:1080,id:'bad',view:'smoothed'}));d.x.reference=3.99;d.x.ticks=[-4,0,3.99,4];d.x.decimals=2;assert.throws(()=>phaseScene(d,{width:1920,height:1080,id:'bad'}));
 const long=sample(0);long.x={...long.x,domain:[999999999.99999,1000000000],ticks:[999999999.99999,999999999.999992,999999999.999994,999999999.999996,999999999.999998,1000000000],reference:999999999.999994,decimals:6};long.points.forEach(p=>p.x=999999999.999994);assert.throws(()=>phaseScene(long,{width:1920,height:1080,id:'bad'}),/x tick labels overlap/);
 const duplicate=sample(0);duplicate.quadrants.NW=' '+duplicate.quadrants.NE+' ';assert.throws(()=>phaseTrail(duplicate),/displayed quadrant labels/);
});
