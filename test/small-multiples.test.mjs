import test from 'node:test';import assert from 'node:assert/strict';
import {rankSeries} from '../film/multiple-data.mjs';import {multipleScene,multipleLayout,rankLabel} from '../film/small-multiples.mjs';
const date=['2024-01-31','2024-03-31','2024-06-30'];
const fixture=()=>({rankAt:date[2],direction:'descending',plot:{title:'Common records',asOf:date[2],source:'Fictional records',x:{type:'date',label:'Date',domain:[date[0],date[2]],ticks:[date[0],date[2]],dateFormat:'month'},y:{type:'linear',label:'Dollars',domain:[-20,40],ticks:[-20,0,40]},motion:'none',series:[['d',[5,8,null]],['b',[20,null,10]],['a',[-10,5,10]],['c',[0,12,-5]]].map(([id,values])=>({id,label:id.toUpperCase(),values:values.map((y,i)=>({x:date[i],y}))}))}});
test('competition ranks preserve equal values, missing endpoints and stable identities',()=>{
 const f=fixture(),before=JSON.stringify(f),r=rankSeries(f);assert.deepEqual(r.panels.map(s=>[s.id,s.value,s.rank,s.tied]),[['a',10,1,true],['b',10,1,true],['c',-5,3,false],['d',null,null,false]]);assert.equal(JSON.stringify(f),before);
 f.plot.series.reverse();assert.deepEqual(rankSeries(f).panels.map(s=>s.id),r.panels.map(s=>s.id));f.direction='ascending';assert.deepEqual(rankSeries(f).panels.map(s=>s.id),['c','a','b','d']);f.rankAt=date[0];assert.deepEqual(rankSeries(f).panels.map(s=>s.id),['a','c','d','b']);
});
test('unmatched grids, missing ranking dates and ambiguous input reject',()=>{
 let f=fixture();f.plot.series[1].values.splice(1,1);assert.throws(()=>rankSeries(f),/same explicit date/);
 f=fixture();f.rankAt='2024-04-30';assert.throws(()=>rankSeries(f),/rankAt/);f=fixture();f.direction='best';assert.throws(()=>rankSeries(f),/direction/);f=fixture();f.plot.y.type='log';assert.throws(()=>rankSeries(f));
 f=fixture();f.plot.series.forEach(s=>s.values[2].y=null);assert(rankSeries(f).panels.every(s=>s.rank===null));f=fixture();f.unused=true;assert.throws(()=>rankSeries(f),/unknown/);
});
test('panel positions preserve shared elapsed dates and domains during uniform expansion',()=>{
 for(const [width,height]of [[1920,1080],[1080,1920]]){
  const r=multipleScene(fixture(),{width,height,id:'fixture',subtitle:'Fictional dated ranks',expandedId:'a'}),L=r.layout,g=r.geometry.filter(p=>p.value!==null),day=x=>Date.parse(x+'T00:00:00Z');
  for(const p of g){const expected=(day(p.date)-day(date[0]))/(day(date[2])-day(date[0]));assert(Math.abs((p.local[0]-r.local.left)/(r.local.right-r.local.left)-expected)<1e-12);assert(Math.abs((r.local.bottom-p.local[1])/(r.local.bottom-r.local.top)-(p.value+20)/60)<1e-12);}
  assert.equal(r.props.elements.filter(e=>e.type==='group').length,4);const group=r.props.elements.find(e=>e.id==='fixture-a-panel');assert.equal(group.keys[1].scale,L.scale);assert.equal(group.keys[1].at,.6);assert.equal(group.keys[1].dur,1.4);
  const b=r.props.elements.find(e=>e.id==='fixture-b-panel');assert(!b.children.some(e=>e.id==='fixture-b-segment-2'));
 }assert.throws(()=>multipleLayout({width:10,height:10}),/dimensions/);
});

test('rank labels retain fractions and qualify residual rounding and multiyear spans',()=>{
 assert.equal(rankLabel(1.3,{type:'linear',decimals:0}),'1.3');assert.equal(rankLabel(1.4,{type:'linear',decimals:0}),'1.4');assert.equal(rankLabel(.00000001,{type:'linear',decimals:0}),'≈0.000000');
 const f=fixture();f.plot.x.domain[1]='2025-06-30';f.plot.x.ticks[1]='2025-06-30';const r=multipleScene(f,{width:1080,height:1920,id:'years',subtitle:'Dated comparisons'});assert.equal(r.props.elements.find(e=>e.id==='years-unit').text,'Dollars · 2024–2025');
});
