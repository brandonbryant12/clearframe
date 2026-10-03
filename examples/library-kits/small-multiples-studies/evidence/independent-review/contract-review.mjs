// Independent rank and geometry checks; no native renderer or browser.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {rankSeries} from '../../../../../fframes/multiple-data.mjs';
import {multipleScene,rankLabel} from '../../../../../fframes/small-multiples.mjs';
let assertions=0,rankCases=0;const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;},near=(a,b)=>{assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);assertions++;},reject=f=>{assert.throws(f);assertions++;};
const dates=['2024-01-31','2024-02-29','2024-06-30'],ids=['delta','alpha','gamma','beta'];
const input=(values,direction='ascending')=>({rankAt:dates[1],direction,plot:{title:'Independent rank fixture',source:'Fictional values',asOf:dates[2],x:{type:'date',label:'Observed dates',domain:[dates[0],dates[2]],ticks:[dates[0],dates[2]],dateFormat:'month'},y:{type:'linear',label:'Signed units',domain:[-1e12,1e12],ticks:[-1e12,0,1e12],decimals:0},motion:'none',series:values.map((v,i)=>({id:ids[i],label:ids[i].toUpperCase(),values:[{x:dates[0],y:0},{x:dates[1],y:v},{x:dates[2],y:v}]}))}});
const values=[-1e12,-1,-Number.MIN_VALUE,0,Number.MIN_VALUE,1,1e12,null];
for(let count=2;count<=4;count++)for(let code=0;code<values.length**count;code++)for(const direction of ['ascending','descending']){
 const entries=Array.from({length:count},(_,i)=>values[Math.floor(code/values.length**i)%values.length]);
 const f=input(entries,direction),before=JSON.stringify(f),r=rankSeries(f);rankCases++;
 // A competition rank is one plus the number of strictly better supplied
 // values. This reference uses comparisons, never subtraction sorting.
 const expected=f.plot.series.map((s,i)=>({id:s.id,value:entries[i],rank:entries[i]===null?null:1+entries.filter(v=>v!==null&&(direction==='ascending'?v<entries[i]:v>entries[i])).length,tied:entries[i]!==null&&entries.filter(v=>v===entries[i]).length>1}));
 expected.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||(a.id<b.id?-1:a.id>b.id?1:0));
 eq(r.panels.map(p=>({id:p.id,value:p.value,rank:p.rank,tied:p.tied})),expected);
 eq(JSON.stringify(f),before);eq(r.plot.x.domain,f.plot.x.domain);eq(r.plot.y.domain,f.plot.y.domain);
 for(const p of r.panels)eq(p.values,f.plot.series.find(s=>s.id===p.id).values);
 if(code%8===0){f.plot.series.reverse();eq(rankSeries(f).panels.map(p=>p.id),expected.map(p=>p.id));}
}
const rankAssertions=assertions;
for(const [width,height] of [[1920,1080],[1080,1920],[640,640],[4096,2160]])for(const count of [2,3,4]){
 const f=input([-1e12,null,1e12,0].slice(0,count));
 for(const selected of f.plot.series.map(s=>s.id)){
  const r=multipleScene(f,{width,height,id:'geometry',subtitle:'Explicit common grid',expandedId:selected,reveal:true}),L=r.layout;
  for(const p of r.geometry){
   const s=f.plot.series.find(s=>s.id===p.seriesId);eq(p.value,s.values[p.index].y);
   if(p.value===null){eq(p.point,null);continue;}
   const u=[0,29/151,1][p.index],v=(p.value+1e12)/2e12;
   near(p.local[0],r.local.left+u*(r.local.right-r.local.left));near(p.local[1],r.local.bottom-v*(r.local.bottom-r.local.top));near(p.at,.7+3.5*u);
  }
  for(const [i,p]of r.model.panels.entries()){
   const g=r.props.elements.find(e=>e.id===`geometry-${p.id}-panel`),box=L.boxes[i];
   eq([g.x,g.y],box.slice(0,2));
   if(p.id===selected){const k=g.keys[1];near(g.x+k.x,L.expanded[0]);near(g.y+k.y,L.expanded[1]);near(box[2]*k.scale,L.expanded[2]);near(box[3]*k.scale,L.expanded[3]);eq(k.scaleX,undefined);eq(k.scaleY,undefined);eq(g.origin,box.slice(0,2));}
   else eq(g.keys,[{at:0,dur:.35,opacity:0,ease:'linear'}]);
   for(let j=1;j<p.values.length;j++)eq(g.children.some(e=>e.id===`geometry-${p.id}-segment-${j}`),p.values[j-1].y!==null&&p.values[j].y!==null);
  }
 }
}
for(const mutate of [f=>f.plot.series[0].values.splice(1,1),f=>f.plot.series[0].values[1].x='2024-03-01',f=>f.rankAt='2024-02-28',f=>f.direction='largest',f=>f.plot.series.splice(1),f=>f.plot.series.push({...f.plot.series[0],id:'fifth',label:'Fifth'}),f=>f.plot.series[0].values[1].y=Infinity,f=>f.plot.series[0].values[1].y=NaN,f=>f.plot.series[0].values[1].y=1e12+1,f=>f.extra=true]){const f=input([0,1,2,3]);mutate(f);reject(()=>rankSeries(f));}
const priorAssertions=assertions;
for(const [value,expected]of [[1.3,'1.3'],[1.4,'1.4'],[-1.3,'-1.3'],[0,'0'],[5,'5'],[1.234567,'1.234567'],[1.2345678,'≈1.234568'],[Number.MIN_VALUE,'≈0.000000']])eq(rankLabel(value,{decimals:0}),expected);
const single=multipleScene(input([0,1]),{width:1920,height:1080,id:'single-year',subtitle:'Year regression'});
eq(single.props.elements.find(e=>e.id==='single-year-unit').text,'Signed units · 2024');
const multi=input([0,1]);multi.plot.x.domain[1]='2025-06-30';multi.plot.x.ticks[1]='2025-06-30';multi.plot.asOf='2025-06-30';for(const series of multi.plot.series)series.values[2].x='2025-06-30';
const spanning=multipleScene(multi,{width:1920,height:1080,id:'multi-year',subtitle:'Year regression'});
eq(spanning.props.elements.find(e=>e.id==='multi-year-unit').text,'Signed units · 2024–2025');
const report={status:'pass',assertions,rankCases,rankAssertions,geometryAndGuardAssertions:priorAssertions-rankAssertions,labelAssertions:assertions-priorAssertions,scope:'Exhaustive 2–4-member ranking combinations over eight signed/extreme/null values, both directions; stable IDs; retained history/domains; missing values; common leap-year date positions; uniformly scaled selected groups at four frame sizes; invalid-grid and numeric guards; exact or explicitly approximate rank labels and year-span labels. No rendering or continuous playback.',sourceHashes:Object.fromEntries(['multiple-data.mjs','small-multiples.mjs','plot-data.mjs'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL('../../../../../fframes/'+name,import.meta.url))).digest('hex')]))};
fs.writeFileSync(new URL('contract-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
