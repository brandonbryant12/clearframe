import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
const root=new URL('../examples/library-kits/drivers-and-flows/',import.meta.url),input=JSON.parse(fs.readFileSync(new URL('inputs.json',root)));
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('both layouts map original bridge amounts to exact shared-scale length and equal-thickness area',()=>{
 for(const c of input.cases.filter(c=>c.recipe!=='C02'))for(const shape of ['landscape','vertical']){
  const sb=JSON.parse(fs.readFileSync(new URL(`specimens/${c.id}-${shape}/storyboard.json`,root))),b=sb.beats.find(b=>b.id===c.id),els=b.props.elements;
  const first=els.find(e=>e.id===`${c.id}-tick-0`),last=els.find(e=>e.id===`${c.id}-tick-${c.ticks.length-1}`),span=last.x1-first.x1,range=c.domain[1]-c.domain[0];
  const px=v=>first.x1+(v-c.domain[0])/range*span;
  let opening,closing,parts;
  if(c.recipe==='C03'){
   const initial=c.first.start*c.second.start;
   opening=0;closing=100*((c.first.end*c.second.end+c.additions.reduce((s,p)=>s+p.amount,0))/initial-1);
   parts=[{id:c.first.id,amount:100*(c.first.end/c.first.start-1)},{id:c.second.id,amount:100*(c.second.end/c.second.start-1)},
    {id:'interaction',amount:100*(c.first.end/c.first.start-1)*(c.second.end/c.second.start-1)},...c.additions.map(p=>({...p,amount:100*p.amount/initial}))];
  }else{
   opening=c.opening;closing=c.closing;parts=[...c.components,{id:'residual',amount:closing-opening-c.components.reduce((s,p)=>s+p.amount,0)}];
  }
  let level=opening;const rows=[{id:'opening',from:0,to:opening},...parts.map(p=>{const from=level;level+=p.amount;return{id:p.id,from,to:level}}),{id:'closing',from:0,to:closing}];
  let thickness;
  for(const r of rows){
   const mark=els.find(e=>e.id===`${c.id}-bar-${r.id}`),amount=Math.abs(r.to-r.from);
   if(amount<1e-10){assert.equal(mark,undefined);continue;}
   assert(mark);thickness??=mark.h;near(mark.h,thickness);near(mark.x,Math.min(px(r.from),px(r.to)));near(mark.w,span*amount/range);
   near(mark.w*mark.h/(span*thickness),amount/range);assert.equal(mark.enter,'fade');assert(!mark.keys&&!mark.scale);
   assert(b.duration>=mark.at+mark.dur+2);
  }
  near(level,closing);
 }
});
test('aligned history plots retain real day offsets, each base, the newer endpoint and an actual gap',()=>{
 for(const c of input.cases.filter(c=>c.recipe==='C02'))for(const shape of ['landscape','vertical']){
  const sb=JSON.parse(fs.readFileSync(new URL(`specimens/${c.id}-${shape}/storyboard.json`,root))),b=sb.beats.find(b=>b.id===c.id),els=b.props.elements;
  const lo=els.find(e=>e.id===`${c.id}-plot-y-grid-0`),hi=els.find(e=>e.id===`${c.id}-plot-y-grid-${c.ticks.length-1}`);
  for(const s of c.series){
   const base=s.observations.find(p=>p.date===s.baseDate).value;
   for(const [i,p]of s.observations.entries()){
    const mark=els.find(e=>e.id===`${c.id}-plot-${s.id}-point-${i}`);
    if(p.value===null){assert.equal(mark,undefined);assert(!els.some(e=>e.id===`${c.id}-plot-${s.id}-segment-${i+1}`));continue;}
    const days=(Date.parse(p.date)-Date.parse(s.baseDate))/86400000,index=100*p.value/base;
    near(mark.cx,lo.x1+days/180*(lo.x2-lo.x1));near(mark.cy,lo.y1-(index-c.domain[0])/(c.domain[1]-c.domain[0])*(lo.y1-hi.y1));near(mark.at,.5+days/180*4);
   }
  }
  const band=els.find(e=>e.id===`${c.id}-older-only`);near(band.x,lo.x1+.5*(lo.x2-lo.x1));near(band.x+band.w,lo.x2);
  assert.equal(c.series[0].observations.length,4);assert(els.find(e=>e.id===`${c.id}-plot-annotation-text`).text.includes('Newer record ends'));
 }
});
