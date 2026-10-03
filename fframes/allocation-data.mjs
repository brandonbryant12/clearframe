// Fixed-quantum allocation. Integer minor units and explicit transfers conserve
// every token; no optimization, fractional token, return or risk model is implied.
import {utcDay} from './plot-data.mjs';
export const ALLOCATION_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`allocation: ${m}`);};
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const own=(o,keys,label)=>{check(o&&typeof o==='object'&&!Array.isArray(o),`${label} must be an object`);for(const k of Object.keys(o))check(keys.includes(k),`unknown ${label}.${k}`);};
const words=(s,n,label)=>check(typeof s==='string'&&s.trim()&&s.length<=n&&!/[\r\n]/.test(s),`${label} needs one line up to ${n} characters`);
const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
export function allocationAmount(minor,q){
 check(q&&integer(q.decimals,0,6)&&integer(q.displayDecimals,0,q.decimals)&&typeof q.unit==='string'&&q.unit.trim(),'valid quantum display contract required');
 check(integer(minor,0,200_000_000_000),'amount must be safe nonnegative minor units');
 const scale=10**q.decimals,divisor=10**(q.decimals-q.displayDecimals);
 check(minor%divisor===0,'amount cannot be shown exactly at displayDecimals');
 const whole=Math.floor(minor/scale),fraction=q.displayDecimals?'.'+String(Math.floor(minor%scale/divisor)).padStart(q.displayDecimals,'0'):'';
 return `${whole}${fraction} ${q.unit}`;
}
export function allocationShare(count,total){
 check(integer(total,1,200)&&integer(count,0,total),'share needs a whole count within a positive total');
 const tenths=Math.round(count*1000/total),exact=tenths*total===count*1000;
 return `${exact?'':'≈'}${tenths%10?`${Math.floor(tenths/10)}.${tenths%10}`:tenths/10}%`;
}
export function allocationPlan(input){
 own(input,['title','source','asOf','period','quantum','buckets','moves','qualification'],'input');
 words(input.title,72,'title');words(input.source,90,'source');words(input.period,48,'period');words(input.qualification,120,'qualification');utcDay(input.asOf);
 const q=input.quantum;own(q,['minorUnits','decimals','displayDecimals','unit'],'quantum');words(q.unit,10,'quantum.unit');
 check(integer(q.minorUnits,1,1e9),'quantum.minorUnits must be 1–1e9');check(integer(q.decimals,0,6),'quantum.decimals must be 0–6');check(integer(q.displayDecimals,0,q.decimals),'displayDecimals must be 0–decimals');
 allocationAmount(q.minorUnits,q);
 check(dense(input.buckets)&&input.buckets.length>=2&&input.buckets.length<=6,'2–6 explicit buckets required');
 const buckets=input.buckets.map(b=>{own(b,['id','label','count'],'bucket');check(typeof b.id==='string'&&/^[a-z][a-z0-9-]{0,23}$/.test(b.id),'bucket id required');words(b.label,24,'bucket label');check(integer(b.count,0,200),'bucket count must be 0–200');return {...b};});
 check(new Set(buckets.map(b=>b.id)).size===buckets.length,'bucket ids must be unique');check(new Set(buckets.map(b=>b.label.trim().replace(/\s+/g,' '))).size===buckets.length,'displayed bucket labels must be distinct');
 const total=buckets.reduce((s,b)=>s+b.count,0);check(total>=2&&total<=200,'total must be 2–200 whole tokens');
 check(dense(input.moves)&&input.moves.length<=64,'moves must be an explicit list of at most 64 groups');
 const stacks=Object.fromEntries(buckets.map(b=>[b.id,[]])),tokens=[];
 for(const b of buckets)for(let i=0;i<b.count;i++){const t={id:`${b.id}-${String(i+1).padStart(3,'0')}`,initialBucket:b.id,initialSlot:i,finalBucket:b.id,finalSlot:i};stacks[b.id].push(t.id);tokens.push(t);}
 const byId=new Map(tokens.map(t=>[t.id,t])),counts=()=>buckets.map(b=>stacks[b.id].length),events=[];
 for(const [groupIndex,g]of input.moves.entries()){
  own(g,['from','to','count'],'move');check(typeof g.from==='string'&&typeof g.to==='string'&&Object.hasOwn(stacks,g.from)&&Object.hasOwn(stacks,g.to)&&g.from!==g.to,'move needs different existing bucket ids as strings');check(integer(g.count,1,200),'move count must be 1–200');check(stacks[g.from].length>=g.count,'move exceeds available source tokens');check(events.length+g.count<=256,'at most 256 token transfers');
  for(let j=0;j<g.count;j++){
   const before=counts(),fromSlot=stacks[g.from].length-1,token=stacks[g.from].pop(),inTransit=counts(),toSlot=stacks[g.to].length;
   stacks[g.to].push(token);const after=counts();events.push({index:events.length,groupIndex,token,from:g.from,to:g.to,fromSlot,toSlot,before,inTransit,after});
   Object.assign(byId.get(token),{finalBucket:g.to,finalSlot:toSlot});
  }
 }
 // Final slots are read from the actual stack, including tokens that traveled
 // more than once. Source selection is deterministic last-slot-first.
 for(const b of buckets)stacks[b.id].forEach((id,i)=>Object.assign(byId.get(id),{finalBucket:b.id,finalSlot:i}));
 const summary=values=>buckets.map((b,i)=>({id:b.id,label:b.label,count:values[i],minorUnits:values[i]*q.minorUnits,share:{numerator:values[i],denominator:total},shareLabel:allocationShare(values[i],total)}));
 const before=summary(buckets.map(b=>b.count)),after=summary(counts()),capacity=buckets.map((b,i)=>Math.max(b.count,...events.map(e=>e.after[i])));
 return {version:ALLOCATION_VERSION,title:input.title,source:input.source,asOf:input.asOf,period:input.period,qualification:input.qualification,quantum:{...q},buckets,total,totalMinorUnits:total*q.minorUnits,tokens,events,before,after,capacity,grossTransfers:events.length,changedOwners:tokens.filter(t=>t.initialBucket!==t.finalBucket).length,selectionPolicy:'Last occupied slot leaves; next free destination slot receives. This is declared choreography, not an optimization.'};
}
export function allocationClock(model,options={}){
 own(options,['initialHold','moveSeconds','settleSeconds','finalHold'],'clock');
 const {initialHold=3,moveSeconds=2.4,settleSeconds=.6,finalHold=7}=options;
 for(const [k,v]of Object.entries({initialHold,moveSeconds,settleSeconds,finalHold}))check(Number.isFinite(v)&&v>0&&v<=30,`${k} must be positive and at most 30 seconds`);
 const events=model.events.map(e=>({...e,start:initialHold+e.index*(moveSeconds+settleSeconds),end:initialHold+e.index*(moveSeconds+settleSeconds)+moveSeconds}));
 return {initialHold,moveSeconds,settleSeconds,finalHold,events,duration:initialHold+events.length*(moveSeconds+settleSeconds)+finalHold};
}
export function allocationState(model,clock,time){
 check(Number.isFinite(time)&&time>=0,'time must be finite and nonnegative');
 let counts=model.before.map(b=>b.count),inTransit=0,activeToken=null;
 for(const e of clock.events){if(time<e.start)break;if(time<e.end){counts=e.inTransit;inTransit=1;activeToken=e.token;break;}counts=e.after;}
 return {counts:[...counts],inTransit,activeToken,total:counts.reduce((s,n)=>s+n,0)+inTransit,minorUnits:counts.map(n=>n*model.quantum.minorUnits),transitMinorUnits:inTransit*model.quantum.minorUnits};
}
