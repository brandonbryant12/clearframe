// Independent integer ledger and swept-rectangle route review. Candidate
// modules are imported only as the system under test; no renderer is used.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {fileURLToPath}from'node:url';
import {allocationPlan,allocationClock,allocationState,allocationAmount,allocationShare}from'../../../../../fframes/allocation-data.mjs';
import {allocationScene}from'../../../../../fframes/allocations.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..'),kit='examples/library-kits/allocation-studies';
const input=JSON.parse(fs.readFileSync(path.join(root,kit,'inputs.json'))).cases.map(({id,...d})=>d);
let assertions=0,modelCases=0,sceneCases=0,negativeCases=0,sweptLegPairs=0,sampledTokenPairs=0,clockStates=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions++;},ok=(a,m)=>{assert.ok(a,m);assertions++;},near=(a,b,tol=1e-7)=>ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const amount=(minor,q)=>{const n=BigInt(minor),scale=10n**BigInt(q.decimals),displayScale=10n**BigInt(q.decimals-q.displayDecimals),whole=n/scale,fraction=q.displayDecimals?'.'+String(n%scale/displayScale).padStart(q.displayDecimals,'0'):'';return `${whole}${fraction} ${q.unit}`;};
const share=(count,total)=>{const n=BigInt(count)*1000n,d=BigInt(total),tenths=n/d+(n%d*2n>=d?1n:0n);return `${tenths*d===n?'':'≈'}${tenths%10n?`${tenths/10n}.${tenths%10n}`:tenths/10n}%`;};
function oracle(d){
 const ids=d.buckets.map(b=>b.id),items=[];for(const b of d.buckets)for(let i=0;i<b.count;i++)items.push({id:`${b.id}-${String(i+1).padStart(3,'0')}`,initialBucket:b.id,initialSlot:i,bucket:b.id,slot:i});
 const count=()=>ids.map(id=>items.filter(t=>t.bucket===id).length),events=[],capacity=count();
 for(let groupIndex=0;groupIndex<d.moves.length;groupIndex++){
  const move=d.moves[groupIndex];for(let j=0;j<move.count;j++){
   const before=count(),selected=items.filter(t=>t.bucket===move.from).sort((a,b)=>b.slot-a.slot)[0],fromSlot=selected.slot;selected.bucket=null;selected.slot=null;const inTransit=count(),toSlot=items.filter(t=>t.bucket===move.to).length;
   selected.bucket=move.to;selected.slot=toSlot;const after=count();after.forEach((n,i)=>capacity[i]=Math.max(capacity[i],n));
   events.push({index:events.length,groupIndex,token:selected.id,from:move.from,to:move.to,fromSlot,toSlot,before,inTransit,after});
  }
 }
 return {items,events,capacity,after:count(),total:items.length};
}
function reviewModel(d,settings){
 const before=structuredClone(d),expected=oracle(d),m=allocationPlan(d),clock=allocationClock(m,settings);modelCases++;
 eq(d,before);eq(m.events,expected.events);eq(m.total,expected.total);eq(m.totalMinorUnits,Number(BigInt(expected.total)*BigInt(d.quantum.minorUnits)));eq(m.capacity,expected.capacity);eq(m.grossTransfers,expected.events.length);
 eq(m.tokens,expected.items.map(t=>({id:t.id,initialBucket:t.initialBucket,initialSlot:t.initialSlot,finalBucket:t.bucket,finalSlot:t.slot})));
 eq(m.changedOwners,expected.items.filter(t=>t.initialBucket!==t.bucket).length);eq(new Set(m.tokens.map(t=>t.id)).size,m.total);
 for(let i=0;i<d.buckets.length;i++)for(const [actual,count]of [[m.before[i],d.buckets[i].count],[m.after[i],expected.after[i]]]){eq(actual.count,count);eq(actual.minorUnits,Number(BigInt(count)*BigInt(d.quantum.minorUnits)));eq(actual.share,{numerator:count,denominator:m.total});eq(actual.shareLabel,share(count,m.total));eq(allocationShare(count,m.total),share(count,m.total));eq(allocationAmount(actual.minorUnits,d.quantum),amount(actual.minorUnits,d.quantum));}
 const samples=[0,clock.duration,clock.duration+100];for(const e of clock.events)samples.push(e.start-1e-7,e.start,e.start+1e-7,(e.start+e.end)/2,e.end-1e-7,e.end,e.end+1e-7);
 for(const time of samples){const status=expected.items.map(t=>({id:t.id,bucket:t.initialBucket}));let active=null;
  for(let i=0;i<expected.events.length;i++){const e=expected.events[i],t=clock.initialHold+i*(clock.moveSeconds+clock.settleSeconds);if(time<t)break;const item=status.find(p=>p.id===e.token);if(time<t+clock.moveSeconds){item.bucket=null;active=item.id;break;}item.bucket=e.to;}
  const counts=d.buckets.map(b=>status.filter(t=>t.bucket===b.id).length),transit=Number(active!==null),actual=allocationState(m,clock,time);clockStates++;
  eq(actual.counts,counts);eq(actual.activeToken,active);eq(actual.inTransit,transit);eq(actual.total,expected.total);eq(actual.minorUnits,counts.map(n=>Number(BigInt(n)*BigInt(d.quantum.minorUnits))));eq(actual.transitMinorUnits,transit*d.quantum.minorUnits);eq(actual.minorUnits.reduce((a,b)=>a+b,0)+actual.transitMinorUnits,m.totalMinorUnits);
  actual.counts[0]=-999;eq(allocationState(m,clock,time).counts,counts);
 }
 eq(d,before);return m;
}
let seed=0x4a110c;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(const d of input){reviewModel(d);reviewModel(d,{initialHold:.5,moveSeconds:.17,settleSeconds:.23,finalHold:.75});}
for(let trial=0;trial<320;trial++){
 const d=structuredClone(input[0]),n=2+random(5),counts=Array.from({length:n},()=>random(25));if(counts.reduce((a,b)=>a+b,0)<2)counts[0]=2;
 d.buckets=counts.map((count,i)=>({id:`bucket-${i}`,label:`Bucket ${i}`,count}));d.moves=[];
 for(let j=0;j<random(20);j++){const from=random(n),to=(from+1+random(n-1))%n;if(!counts[from])continue;const count=1+random(Math.min(counts[from],5));d.moves.push({from:d.buckets[from].id,to:d.buckets[to].id,count});counts[from]-=count;counts[to]+=count;}
 d.quantum=[{minorUnits:1,decimals:6,displayDecimals:6,unit:'units'},{minorUnits:125,decimals:2,displayDecimals:2,unit:'USD'},{minorUnits:1000000000,decimals:0,displayDecimals:0,unit:'units'},{minorUnits:999999999,decimals:6,displayDecimals:6,unit:'units'}][trial%4];reviewModel(d);
}
for(const total of [2,3,6,7,24,36,99,199,200])for(let count=0;count<=total;count++)eq(allocationShare(count,total),share(count,total));
const parkedPosition=(g,bucket,index)=>{const c=g.cards.find(c=>c.id===bucket);return[c.gridX+(index%c.columns)*(g.size+g.size*.32),c.gridY+Math.floor(index/c.columns)*(g.size+g.size*.32)];};
function position(track,time){let last=[0,0];for(const k of track.keys){if(time<k.at)break;const target=[k.x,k.y];if(time<k.at+k.dur){const f=(time-k.at)/k.dur;return track.initial.map((v,i)=>v+last[i]+f*(target[i]-last[i]));}last=target;}return track.initial.map((v,i)=>v+last[i]);}
const overlap=(a,b)=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-7&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-7;
const scenes=[...input];const round=structuredClone(input[0]);round.moves=[{from:'bills',to:'buffer',count:1},{from:'buffer',to:'bills',count:1}];scenes.push(round);const zero=structuredClone(input[0]);zero.buckets[0].count=10;zero.buckets[1].count=8;zero.moves=[{from:'buffer',to:'bills',count:2}];scenes.push(zero);
for(const d of scenes)for(const [width,height]of [[1920,1080],[1080,1920]])for(const timing of [undefined,{initialHold:5,moveSeconds:4,settleSeconds:1,finalHold:8}]){
 const s=allocationScene(d,{width,height,id:'review',timing}),{model:m,clock:c,geometry:g}=s,expected=oracle(d),els=s.props.elements,tokens=els.filter(e=>e.id.startsWith('review-token-'));sceneCases++;
 eq(tokens.length,expected.total);eq(new Set(tokens.map(t=>t.id)).size,expected.total);eq(g.routes.length,expected.events.length);eq(s.duration,c.duration);const tc=timing??{initialHold:3,moveSeconds:2.4,settleSeconds:.6,finalHold:7};near(c.duration,tc.initialHold+expected.events.length*(tc.moveSeconds+tc.settleSeconds)+tc.finalHold);for(let i=0;i<expected.events.length;i++){near(c.events[i].start,tc.initialHold+i*(tc.moveSeconds+tc.settleSeconds));near(c.events[i].end,tc.initialHold+i*(tc.moveSeconds+tc.settleSeconds)+tc.moveSeconds);}
 for(const token of tokens){eq([token.w,token.h],[g.size,g.size]);eq(token.enter,'none');eq(token.at,0);eq(token.exitAt,undefined);for(const key of token.keys){eq(Object.keys(key).sort(),['at','dur','ease','x','y']);eq(key.ease,'linear');ok(key.dur>0);}}
 const parked=new Map(m.tokens.map(t=>[t.id,parkedPosition(g,t.initialBucket,t.initialSlot)])),times=new Set([0,c.duration,c.duration+1]);
 for(let i=0;i<g.routes.length;i++){
  const route=g.routes[i],e=expected.events[i];eq(route.token,e.token);eq(route.points[0],parked.get(e.token));eq(route.points.at(-1),parkedPosition(g,e.to,e.toSlot));near(route.legs[0].start,c.events[i].start);near(route.legs.at(-1).end,c.events[i].end);
  let distance=0;for(const leg of route.legs){const dx=leg.to[0]-leg.from[0],dy=leg.to[1]-leg.from[1];ok(dx===0||dy===0);ok(dx!==0||dy!==0);distance+=Math.hypot(dx,dy);}
  for(const leg of route.legs){near((leg.end-leg.start)*distance,Math.hypot(leg.to[0]-leg.from[0],leg.to[1]-leg.from[1])*(c.events[i].end-c.events[i].start),1e-5);times.add(leg.start);times.add((leg.start+leg.end)/2);times.add(leg.end);const swept=[Math.min(leg.from[0],leg.to[0]),Math.min(leg.from[1],leg.to[1]),Math.max(leg.from[0],leg.to[0])+g.size,Math.max(leg.from[1],leg.to[1])+g.size];
   for(const [id,p]of parked)if(id!==e.token){const stationary=[p[0]-2,p[1]-2,p[0]+g.size+2,p[1]+g.size+2];ok(!overlap(swept,stationary),`swept route collision ${e.token} with ${id}`);sweptLegPairs++;}
  }
  parked.set(e.token,route.points.at(-1));for(const time of [route.start-1e-6,route.start,route.start+1e-6,route.end-1e-6,route.end,route.end+1e-6])times.add(time);
 }
 for(const t of m.tokens){eq(g.finalPositions[t.id],parkedPosition(g,t.finalBucket,t.finalSlot));const p=position(g.tracks.find(p=>p.id===t.id),c.duration);near(p[0],g.finalPositions[t.id][0]);near(p[1],g.finalPositions[t.id][1]);}
 for(const time of [...times].reverse()){
  const positions=g.tracks.map(t=>position(t,time));for(const p of positions){ok(p[0]>=width*.08-1e-7&&p[0]+g.size<=width*.92+1e-7);ok(p[1]>=height*.28-1e-7&&p[1]+g.size<=height*.80+1e-7);}
  for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const [a,b]=[positions[i],positions[j]];ok(!overlap([a[0],a[1],a[0]+g.size,a[1]+g.size],[b[0],b[1],b[0]+g.size,b[1]+g.size]));sampledTokenPairs++;}
  const state=allocationState(m,c,time),visible=e=>time>=e.at&&(e.exitAt===undefined||time<e.exitAt);
  for(let i=0;i<m.buckets.length;i++){const texts=els.filter(e=>e.id.startsWith('review-amount-')&&e.id.endsWith('-'+m.buckets[i].id)&&visible(e));eq(texts.length,1);eq(texts[0].text,`${state.counts[i]} tiles · ${amount(state.counts[i]*d.quantum.minorUnits,d.quantum)}`);}
  const totals=els.filter(e=>e.id.startsWith('review-conservation-')&&visible(e));eq(totals.length,1);eq(totals[0].text,`${m.total-state.inTransit} parked + ${state.inTransit} in transit = ${m.total} tiles`);
 }
 const comparison=allocationScene(d,{width,height,id:'compare',view:'comparison',timing}),cg=comparison.geometry.comparison;sceneCases++;
 eq(cg.scale,[0,m.total]);for(let i=0;i<m.buckets.length;i++)for(const [phase,count]of [['before',m.before[i].count],['after',m.after[i].count]]){const mark=comparison.props.elements.find(e=>e.id===`compare-${phase}-${i}`);if(count){ok(mark);eq(mark.x,cg.left);near(mark.w*m.total,cg.barWidth*count);eq(mark.h,cg.barHeight);}else eq(mark,undefined);}
 eq(cg.ticks[0],0);eq(cg.ticks.at(-1),m.total);for(let j=0;j<cg.ticks.length;j++){const v=cg.ticks[j];ok(Number.isInteger(v)&&v>=0&&v<=m.total&&(!j||v>cg.ticks[j-1]));const tick=comparison.props.elements.find(e=>e.id===`compare-tick-${j}`);eq(tick.text,`${v}${j===cg.ticks.length-1?' tiles':''}`);near((tick.x-cg.left)*m.total,cg.barWidth*v);for(let i=0;i<m.buckets.length;i++){const grid=comparison.props.elements.find(e=>e.id===`compare-grid-${i}-${j}`);near((grid.x1-cg.left)*m.total,cg.barWidth*v);eq(grid.x2,grid.x1);ok(grid.y2>grid.y1);}}
 const firstName=comparison.props.elements.find(e=>e.id==='compare-name-0');for(const phase of ['before','after'])ok(comparison.props.elements.find(e=>e.id===`compare-${phase}-legend`).y<firstName.y);
 const changed=m.before.some((b,i)=>b.count!==m.after[i].count);if(!changed)ok(!els.find(e=>e.id==='review-finished')?.text.includes('different allocation'),'pure round trip must not claim a different allocation');
}
const negatives=[['from array',d=>d.moves[0].from=[d.moves[0].from]],['to array',d=>d.moves[0].to=[d.moves[0].to]],['from object',d=>d.moves[0].from={}],['unknown bucket',d=>d.moves[0].to='unknown'],['self transfer',d=>d.moves[0].to=d.moves[0].from],['overdraw',d=>d.moves[0].count=13],['fractional move',d=>d.moves[0].count=.5],['zero move',d=>d.moves[0].count=0],['sparse moves',d=>delete d.moves[0]],['extra move field',d=>d.moves[0].interpolate=true],['fractional quantum',d=>d.quantum.minorUnits=.5],['zero quantum',d=>d.quantum.minorUnits=0],['large quantum',d=>d.quantum.minorUnits=1000000001],['rounded quantum',d=>d.quantum.minorUnits=10001],['bad precision',d=>d.quantum.decimals=7],['fractional precision',d=>d.quantum.decimals=.5],['display beyond storage',d=>d.quantum.displayDecimals=3],['negative display',d=>d.quantum.displayDecimals=-1],['empty unit',d=>d.quantum.unit=''],['fractional count',d=>d.buckets[0].count=.1],['negative count',d=>d.buckets[0].count=-1],['nonfinite count',d=>d.buckets[0].count=Infinity],['string count',d=>d.buckets[0].count='12'],['all empty',d=>d.buckets.forEach(b=>b.count=0)],['single token',d=>{d.buckets.forEach(b=>b.count=0);d.buckets[0].count=1;}],['too many tokens',d=>d.buckets[0].count=200],['sparse bucket',d=>delete d.buckets[0]],['duplicate id',d=>d.buckets[1].id=d.buckets[0].id],['duplicate display label',d=>d.buckets[1].label=' '+d.buckets[0].label+' '],['invalid id',d=>d.buckets[0].id='Bad'],['bad calendar',d=>d.asOf='2026-02-30'],['empty title',d=>d.title=' '],['multiline copy',d=>d.title='one\ntwo'],['missing qualification',d=>delete d.qualification],['unknown field',d=>d.extra=true]];
for(const [label,edit]of negatives){const d=structuredClone(input[0]);edit(d);assert.throws(()=>allocationPlan(d),undefined,label);negativeCases++;}
for(const settings of [{initialHold:0},{moveSeconds:NaN},{settleSeconds:-1},{finalHold:31}]){assert.throws(()=>allocationClock(allocationPlan(input[0]),settings));negativeCases++;}
assert.throws(()=>allocationClock(allocationPlan(input[0]),{speed:2}));negativeCases++;
for(const [count,total]of [[1,0],[-1,20],[21,20],[.5,20],[1,Infinity],[1,201],['1',20]]){assert.throws(()=>allocationShare(count,total));negativeCases++;}
for(const [value,q]of [[-1,input[0].quantum],[.5,input[0].quantum],[NaN,input[0].quantum],[200000000001,input[0].quantum],[1,input[0].quantum],[1,null],[1,{decimals:2,displayDecimals:3,unit:'x'}],[1,{decimals:0,displayDecimals:0,unit:''}]]){assert.throws(()=>allocationAmount(value,q));negativeCases++;}
for(const [label,edit]of [['seven buckets',d=>d.buckets=Array.from({length:7},(_,i)=>({id:`b-${i}`,label:`B ${i}`,count:2}))],['65 groups',d=>d.moves=Array.from({length:65},(_,i)=>({from:i%2?'buffer':'bills',to:i%2?'bills':'buffer',count:1}))],['more than 256 transfers',d=>{d.buckets=[{id:'a',label:'A',count:200},{id:'b',label:'B',count:0}];d.moves=[{from:'a',to:'b',count:200},{from:'b',to:'a',count:57}];}]]){const d=structuredClone(input[0]);edit(d);assert.throws(()=>allocationPlan(d),undefined,label);negativeCases++;}
for(const [label,edit]of [['four native buckets',d=>d.buckets.push({id:'fourth',label:'Fourth',count:0})],['more than 36 native tokens',d=>d.buckets[0].count=36],['nine native moves',d=>d.moves=Array.from({length:9},(_,i)=>({from:i%2?'buffer':'bills',to:i%2?'bills':'buffer',count:1}))],['excess portrait tray capacity',d=>d.moves=[{from:'buffer',to:'bills',count:2}]]]){const d=structuredClone(input[0]);edit(d);assert.throws(()=>allocationScene(d,{width:1080,height:1920,id:'bad'}),undefined,label);negativeCases++;}
for(const t of [-1,NaN,Infinity]){const m=allocationPlan(input[0]);assert.throws(()=>allocationState(m,allocationClock(m),t));negativeCases++;}
for(const options of [{width:400,height:1920,id:'bad'},{width:1920,height:1080,id:'Bad'},{width:1920,height:1080,id:'bad',view:'pie'}]){assert.throws(()=>allocationScene(input[0],options));negativeCases++;}
for(const timing of [{moveSeconds:-1},{speed:2}]){assert.throws(()=>allocationScene(input[0],{width:1920,height:1080,id:'bad',timing}));negativeCases++;}
const files=['fframes/allocation-data.mjs','fframes/allocations.mjs',kit+'/inputs.json',kit+'/evidence/independent-review/contract-check.mjs'],bindings=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const readingStates=input.map(d=>{const s=allocationScene(d,{width:1080,height:1920,id:'reading'}),times=[0,...s.clock.events.flatMap(e=>[e.start+1e-6,e.end+1e-6])],counts=times.map(t=>s.props.elements.filter(e=>e.type==='text'&&t>=e.at&&(e.exitAt===undefined||t<e.exitAt)).reduce((n,e)=>n+e.text.trim().split(/\s+/).length,0));return {title:d.title,duration:s.duration,minVisibleWhitespaceWords:Math.min(...counts),maxVisibleWhitespaceWords:Math.max(...counts),transitSeconds:s.clock.moveSeconds,intermediateSettledSeconds:s.clock.settleSeconds,finalSettledSeconds:s.duration-s.clock.events.at(-1).end};});
const report={passed:true,modelCases,sceneCases,assertions,negativeCases,clockStates,sweptLegPairs,sampledTokenPairs,readingStates,seed:'0x4a110c',method:'Independent per-token owner/slot ledger; BigInt amount/share references; event boundary accounting; exact swept rectangles plus arbitrary-order sampled native translation tracks and live readouts.',bindings};fs.writeFileSync(path.join(here,'contract-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,bindings:undefined}));
