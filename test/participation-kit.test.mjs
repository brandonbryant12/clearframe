import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
const root=new URL('../examples/library-kits/participation-and-benchmarks/',import.meta.url),input=JSON.parse(fs.readFileSync(new URL('inputs.json',root)));
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const color={meets:'#315cce',other:'#c2641f',missing:'#796499'};
const state=(c,p)=>p.value===null?'missing':(c.condition.operator==='gt'?p.value>c.condition.threshold:p.value>=c.condition.threshold)?'meets':'other';
test('membership pictures count all members equally and preserve weighted and missing shares without renormalization',()=>{
 for(const c of input.cases.filter(c=>c.recipe==='C05'))for(const shape of ['landscape','vertical']){
  const sb=JSON.parse(fs.readFileSync(new URL(`specimens/${c.id}-${shape}/storyboard.json`,root))),count=sb.beats[0],weight=sb.beats[1];
  const tiles=count.props.elements.filter(e=>e.id.includes('-tile-'));assert.equal(tiles.length,c.members.length);
  const area=tiles[0].w*tiles[0].h;
  c.members.forEach(p=>{const e=tiles.find(e=>e.id.endsWith(`-tile-${p.id}`));near(e.w,e.h);near(e.w*e.h,area);assert.equal(e.fill,color[state(c,p)]);assert.equal(e.enter,'fade');assert(!e.keys&&!e.scale);});
  assert(count.props.elements.find(e=>e.id.endsWith('-summary')).at>=Math.max(...tiles.map(t=>t.at+t.dur)));
  const bars=weight.props.elements.filter(e=>e.id.includes('-weight-')&&e.type==='rect');
  const span=bars.reduce((s,p)=>s+p.w,0),total=c.members.reduce((s,p)=>s+p.weight,0);let x=bars[0].x;
  for(const kind of ['meets','other','missing']){
   const amount=c.members.filter(p=>state(c,p)===kind).reduce((s,p)=>s+p.weight,0),e=bars.find(e=>e.id.endsWith(`-weight-${kind}`));
   if(amount===0){assert.equal(e,undefined);continue;}
   near(e.x,x);near(e.w/span,amount/total);near(e.h,bars[0].h);near(e.w*e.h/(span*bars[0].h),amount/total);assert.equal(e.fill,color[kind]);assert.equal(e.enter,'fade');x+=e.w;
  }
 }
});
test('relative endpoint position encodes percentage-point difference and circle area encodes only the separate size',()=>{
 for(const c of input.cases.filter(c=>c.recipe==='C08'))for(const shape of ['landscape','vertical']){
  const sb=JSON.parse(fs.readFileSync(new URL(`specimens/${c.id}-${shape}/storyboard.json`,root))),b=sb.beats[1],els=b.props.elements;
  const left=els.find(e=>e.id===`${c.id}-tick-0`).x1,right=els.find(e=>e.id===`${c.id}-tick-${c.ticks.length-1}`).x1;
  const px=v=>left+(v-c.domain[0])/(c.domain[1]-c.domain[0])*(right-left),width=sb.format.preset==='landscape'?1920:1080;
  for(const p of c.items){
   const circle=els.find(e=>e.id===`${c.id}-bubble-${p.id}`),stem=els.find(e=>e.id===`${c.id}-stem-${p.id}`),cross=els.find(e=>e.id===`${c.id}-zero-a-${p.id}`);
   if(p.value===null){assert(!circle&&!stem&&!cross);continue;}
   const difference=p.value-c.benchmark;
   if(difference){near(stem.x1,px(0));near(stem.x2,px(difference));assert.equal(stem.enter,'fade');}
   if(p.size===0){assert(!circle);near((cross.x1+cross.x2)/2,px(difference));continue;}
   near(circle.cx,px(difference));near(Math.PI*circle.r**2/(Math.PI*(width*.025)**2),p.size/c.maxSize);assert.equal(circle.enter,'fade');assert(!circle.keys&&!circle.scale);
  }
 }
});
