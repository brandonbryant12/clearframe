// Auditable, deterministic transformations. Values stay unrounded until display.
// These are algebraic helpers, not forecasts, index methodologies or causal attribution.
import {utcDay} from '../../film/plot-data.mjs';
export const DATA_MODEL_VERSION = 1;
const check=(ok,message)=>{if(!ok)throw Error(`data transform: ${message}`);};
function object(v,keys,name){
  check(v&&typeof v==='object'&&!Array.isArray(v),`${name} must be an object`);
  for(const k of Object.keys(v))check(keys.includes(k),`unknown ${name}.${k}`);
}
function number(v,name){check(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12,`${name} must be finite within ±10^12`);return v;}
function label(v,name){check(typeof v==='string'&&v.trim()&&v.length<=60,`${name} needs 1–60 characters`);return v;}
function id(v,name){check(typeof v==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(v),`${name} needs a lowercase identifier`);return v;}
function sum(values){
  // Neumaier summation retains small signed components beside larger values.
  let total=0,correction=0;
  for(const v of values){const next=total+v;correction+=Math.abs(total)>=Math.abs(v)?(total-next)+v:(v-next)+total;total=next;}
  return number(total+correction,'sum');
}
function components(input,name){
  check(Array.isArray(input)&&input.length<=12,`${name} needs at most 12 components`);
  const ids=new Set();
  return input.map((p,i)=>{
    object(p,['id','label','amount'],`${name}[${i}]`);
    id(p.id,`${name}[${i}].id`);check(!ids.has(p.id)&&p.id!=='residual'&&p.id!=='interaction','component identifiers must be unique and not reserved');ids.add(p.id);
    return{id:p.id,label:label(p.label,`${name}[${i}].label`),amount:number(p.amount,`${name}[${i}].amount`)};
  });
}

/** An exact observed anchor is required; nulls stay missing and no dates are interpolated. */
export function rebaseSeries(input){
  object(input,['observations','baseDate','baseIndex'],'rebase');
  const anchor=utcDay(input.baseDate),baseIndex=number(input.baseIndex,'baseIndex');check(baseIndex>0,'baseIndex must be positive');
  check(Array.isArray(input.observations)&&input.observations.length>=1&&input.observations.length<=1200,'observations needs 1–1200 records');
  let previous=-Infinity;
  const observations=input.observations.map((p,i)=>{
    object(p,['date','value'],`observations[${i}]`);const day=utcDay(p.date);
    check(day>previous,'observation dates must strictly increase');previous=day;
    return{date:p.date,day,value:p.value===null?null:number(p.value,`observations[${i}].value`)};
  });
  const base=observations.find(p=>p.day===anchor);check(base&&base.value!==null&&base.value>0,'baseDate must name an observed positive value');
  return{modelVersion:DATA_MODEL_VERSION,method:'observed-anchor-ratio',baseDate:input.baseDate,baseIndex,baseValue:base.value,
    observations:observations.map(p=>({date:p.date,elapsedDays:p.day-anchor,value:p.value,index:p.value===null?null:number(p.value/base.value*baseIndex,'rebased value')}))};
}

/** Exact two-factor change plus separately named additive amounts.
 * (a1*b1-a0*b0) = (a1-a0)*b0 + (b1-b0)*a0 + (a1-a0)*(b1-b0).
 * The interaction is kept, never assigned silently to either factor.
 */
export function decomposeProduct(input){
  object(input,['first','second','additions'],'product');
  const factors=['first','second'].map(name=>{
    const f=input[name];object(f,['id','label','start','end'],name);
    const start=number(f.start,`${name}.start`),end=number(f.end,`${name}.end`);
    check(start>0&&end>=0,'product factors need positive starts and nonnegative ends');
    return{id:id(f.id,`${name}.id`),label:label(f.label,`${name}.label`),start,end};
  });
  const [a,b]=factors,opening=number(a.start*b.start,'opening product'),endingProduct=number(a.end*b.end,'ending product');
  check(opening>0,'opening product must remain positive');
  const additions=components(input.additions??[],'additions');
  const ids=[a.id,b.id,...additions.map(p=>p.id)];check(new Set(ids).size===ids.length&&!ids.includes('interaction')&&!ids.includes('residual'),'factor/addition identifiers must be unique and not reserved');
  const da=a.end-a.start,db=b.end-b.start;
  const parts=[{id:a.id,label:a.label,amount:number(da*b.start,'first effect'),kind:'factor'},
    {id:b.id,label:b.label,amount:number(db*a.start,'second effect'),kind:'factor'},
    {id:'interaction',label:'Interaction',amount:number(da*db,'interaction'),kind:'interaction'},
    ...additions.map(p=>({...p,kind:'additive'}))];
  const additiveTotal=sum(additions.map(p=>p.amount)),combinedValue=number(endingProduct+additiveTotal,'combined value');
  const change=number(combinedValue-opening,'change');
  return{modelVersion:DATA_MODEL_VERSION,method:'two-factor-with-explicit-interaction',factors,opening,endingProduct,additiveTotal,combinedValue,change,
    changeFraction:number(change/opening,'change fraction'),
    parts:parts.map(p=>({...p,fraction:number(p.amount/opening,'contribution fraction')})),
    arithmeticDifference:number(change-sum(parts.map(p=>p.amount)),'arithmetic difference')};
}

/** Reconcile supplied signed changes to an independently observed closing value.
 * A nonzero residual is unexplained data, not automatically a transaction or valuation gain.
 */
export function reconcileStock(input){
  object(input,['opening','closing','components'],'reconciliation');
  const opening=number(input.opening,'opening'),closing=number(input.closing,'closing');
  const supplied=components(input.components,'components'),suppliedNetChange=sum(supplied.map(p=>p.amount));
  const explainedClosing=sum([opening,suppliedNetChange]);
  const residual=number(closing-explainedClosing,'unexplained residual');
  return{modelVersion:DATA_MODEL_VERSION,method:'opening-plus-signed-changes-and-explicit-residual',opening,closing,
    netChange:number(closing-opening,'net change'),suppliedNetChange,explainedClosing,residual,
    components:[...supplied.map(p=>({...p,kind:'supplied'})),{id:'residual',label:'Unexplained',amount:residual,kind:'residual'}]};
}

/** Count share and weight share retain the full dated membership denominator.
 * Missing observations are a separate state, never silently dropped or treated as failures.
 */
export function summarizeMembership(input){
  object(input,['membershipDate','metricAsOf','condition','members'],'membership');
  utcDay(input.membershipDate);utcDay(input.metricAsOf);
  object(input.condition,['operator','threshold'],'condition');
  const {operator}=input.condition,threshold=number(input.condition.threshold,'threshold');
  check(['gt','gte','lt','lte'].includes(operator),'operator must be gt, gte, lt or lte');
  check(Array.isArray(input.members)&&input.members.length>=1&&input.members.length<=100,'members needs 1–100 records');
  const seen=new Set(),members=input.members.map((p,i)=>{
    object(p,['id','label','value','weight'],`members[${i}]`);id(p.id,`members[${i}].id`);check(!seen.has(p.id),'member identifiers must be unique');seen.add(p.id);
    label(p.label,`members[${i}].label`);const weight=number(p.weight,`members[${i}].weight`);check(weight>=0,'weights must be nonnegative');
    const value=p.value===null?null:number(p.value,`members[${i}].value`);
    const meets=value===null?null:({gt:()=>value>threshold,gte:()=>value>=threshold,lt:()=>value<threshold,lte:()=>value<=threshold})[operator]();
    return{id:p.id,label:p.label,value,weight,state:meets===null?'missing':meets?'meets':'other'};
  });
  const totalWeight=sum(members.map(p=>p.weight));check(totalWeight>0,'membership needs a positive total weight');
  const groups=['meets','other','missing'].map(state=>{
    const rows=members.filter(p=>p.state===state),weight=sum(rows.map(p=>p.weight));
    return{state,count:rows.length,weight,countFraction:rows.length/members.length,weightFraction:weight/totalWeight};
  });
  return{modelVersion:DATA_MODEL_VERSION,method:'full-membership-count-and-weight-shares',membershipDate:input.membershipDate,metricAsOf:input.metricAsOf,
    condition:{operator,threshold},totalCount:members.length,totalWeight,observedCount:members.filter(p=>p.state!=='missing').length,
    observedWeight:sum(members.filter(p=>p.state!=='missing').map(p=>p.weight)),groups,
    members:members.map(p=>({...p,weightFraction:p.weight/totalWeight}))};
}

/** Signed difference in the original metric's units, never a ratio or return index.
 * A missing observation has no relative endpoint. Optional size stays nonnegative.
 */
export function benchmarkDifferences(input){
  object(input,['benchmark','items'],'benchmark comparison');
  const benchmark=number(input.benchmark,'benchmark');check(Array.isArray(input.items)&&input.items.length>=1&&input.items.length<=12,'items needs 1–12 records');
  const seen=new Set(),items=input.items.map((p,i)=>{
    object(p,['id','label','value','size'],`items[${i}]`);id(p.id,`items[${i}].id`);check(!seen.has(p.id),'item identifiers must be unique');seen.add(p.id);
    label(p.label,`items[${i}].label`);const value=p.value===null?null:number(p.value,`items[${i}].value`);
    const size=p.size===undefined?null:number(p.size,`items[${i}].size`);check(size===null||size>=0,'size must be nonnegative');
    return{id:p.id,label:p.label,value,size,difference:value===null?null:number(value-benchmark,'difference')};
  });
  return{modelVersion:DATA_MODEL_VERSION,method:'signed-metric-difference',benchmark,items};
}
