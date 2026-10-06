import test from 'node:test';import assert from 'node:assert/strict';
import {correlationMatrix} from '../film/correlation-data.mjs';
import {correlationScene,correlationColor} from '../film/correlations.mjs';
const dates=['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-05-31','2024-06-30'];
const input=()=>({plot:{title:'Aligned returns',source:'Fictional monthly simple returns.',asOf:'2024-06-30',x:{type:'date',label:'Month end',domain:[dates[0],dates.at(-1)],ticks:[dates[0],dates.at(-1)],dateFormat:'month'},y:{type:'linear',label:'Monthly return',domain:[-5,5],ticks:[-5,0,5],suffix:'%'},series:[{id:'a',label:'A',values:[-3,-2,-1,1,2,3].map((y,i)=>({x:dates[i],y}))},{id:'b',label:'B',values:[3,2,1,-1,-2,-3].map((y,i)=>({x:dates[i],y}))}],motion:'none'},method:'pearson',frequency:'monthly',returnType:'simple-percent',window:{start:dates[0],end:dates.at(-1)},minObservations:3});
test('correlation uses only paired dates and keeps undefined separate from zero',()=>{
 const x=input(),original=structuredClone(x),m=correlationMatrix(x);assert.ok(Math.abs(m.cells[1].value+1)<1e-14);assert.deepEqual(x,original);
 x.plot.series[1].values[1].y=null;const c=correlationMatrix(x).cells[1];assert.equal(c.n,5);assert.deepEqual(c.missingDates,[dates[1]]);assert.ok(Math.abs(c.value+1)<1e-14);
 x.minObservations=6;assert.equal(correlationMatrix(x).cells[1].reason,'insufficient-pairs');
 x.minObservations=3;x.plot.series[1].values.forEach(v=>v.y=0);assert.equal(correlationMatrix(x).cells[3].reason,'zero-variance');assert.equal(correlationMatrix(x).cells[1].value,null);
});
test('monthly return contract rejects mixed grids, frequencies, windows and impossible simple returns',()=>{
 for(const edit of [x=>x.frequency='daily',x=>x.method='spearman',x=>x.returnType='price',x=>x.window.start='2024-01-01',x=>x.minObservations=2,x=>x.plot.series[1].values[1].x='2024-02-28',x=>x.plot.asOf='2024-05-31',x=>{x.plot.y.domain=[-200,5];x.plot.y.ticks=[-200,0,5];x.plot.series[0].values[0].y=-101;},x=>{for(const s of x.plot.series)s.values.splice(2,1);},x=>x.extra=true]){const x=input();edit(x);assert.throws(()=>correlationMatrix(x));}
});
test('rescaling avoids underflow and preserves tiny real differences',()=>{
 for(const values of [[0,1,2,3,4,5].map(v=>v*Number.MIN_VALUE),[0,1,2,3,4,5].map(v=>1e12+v*.0001220703125)]){
  const x=input();x.plot.y.domain=[-100,1e12];x.plot.y.ticks=[-100,0,1e12];if(values.at(-1)>1e12){for(let i=0;i<values.length;i++)values[i]-=1;}
  x.plot.series.forEach(s=>s.values.forEach((v,i)=>v.y=values[i]));assert.ok(Math.abs(correlationMatrix(x).cells[1].value-1)<1e-14);
 }
});
test('native matrices share fixed color endpoints and paired charts retain gaps and common scales',()=>{
 const x=input();x.plot.series[1].values[2].y=null;
 for(const [width,height]of [[1920,1080],[1080,1920]]){
  const m=correlationScene(x,{width,height,id:'matrix',selectedPair:['a','b'],reveal:true});assert.equal(m.geometry.cells.length,4);assert.equal(m.geometry.cells[1].n,5);assert.equal(m.geometry.cells[1].fill,correlationColor(-1));
  const p=correlationScene(x,{width,height,id:'pair',selectedPair:['a','b'],view:'pair',reveal:true});assert.equal(p.geometry.points.length,12);assert.equal(p.geometry.points.find(v=>v.seriesId==='a'&&v.date===dates[2]).paired,false);assert.equal(p.geometry.points.find(v=>v.seriesId==='b'&&v.date===dates[2]).point,null);assert.equal(p.geometry.segments.filter(v=>v.seriesId==='b').length,3);
  for(const g of p.props.elements.filter(e=>e.type==='group')){const first=g.children.findIndex(e=>e.type==='circle');assert.ok(first>0);assert.ok(g.children.slice(first).every(e=>e.type==='circle'));}
 }
 assert.notEqual(correlationColor(null),correlationColor(0));assert.throws(()=>correlationColor(1.001));
});
