// Prepared expectations: publication-aware vintages, maturity curves and declared scenarios.
import {utcDay} from '../../film/plot-data.mjs';
export const EXPECTATIONS_VERSION=1;
const check=(ok,message)=>{if(!ok)throw Error(`expectations: ${message}`);};
const object=(v,keys,name)=>{check(v&&typeof v==='object'&&!Array.isArray(v),`${name} must be an object`);for(const k of Object.keys(v))check(keys.includes(k),`unknown ${name}.${k}`);};
const num=(v,name)=>{check(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12,`${name} must be finite within ±10^12`);return v;};
const nullable=(v,name)=>v===null?null:num(v,name);
const list=(v,min,max,name)=>check(Array.isArray(v)&&v.length>=min&&v.length<=max,`${name} needs ${min}–${max} entries`);
const label=(v,name)=>{check(typeof v==='string'&&v.trim().length>0&&v.length<=100,`${name} needs a short label`);return v;};
function datedValues(values,key='date'){
 list(values,1,1200,'values');let last=-Infinity;
 return values.map(v=>{object(v,[key,'value'],'value');const day=utcDay(v[key]);check(day>last,'value dates must strictly increase');last=day;return{[key]:v[key],value:nullable(v.value,'value')};});
}

/** Returns only information released by asOf. A null revision is a withdrawal,
 * not permission to resurrect an older value. Forecasts must target today or later.
 */
export function vintageSnapshot(input){
 object(input,['asOf','vintages','releases'],'vintage snapshot');const cutoff=utcDay(input.asOf);
 list(input.vintages,1,100,'vintages');list(input.releases,0,12000,'releases');const seen=new Set();let last=-Infinity;
 const vintages=input.vintages.map(v=>{object(v,['id','issuedAt','values'],'vintage');label(v.id,'vintage id');check(!seen.has(v.id),'duplicate vintage id');seen.add(v.id);const issued=utcDay(v.issuedAt);check(issued>last,'vintage issue dates must strictly increase');last=issued;const values=datedValues(v.values,'targetDate');for(const p of values)check(utcDay(p.targetDate)>=issued,'forecast target must not precede its issue date');return{id:v.id,issuedAt:v.issuedAt,values};});
 const revisions=new Set(),releases=input.releases.map(r=>{object(r,['targetDate','releasedAt','value'],'release');const target=utcDay(r.targetDate),released=utcDay(r.releasedAt);check(released>=target,'actual release must not precede its observation date');const identity=`${r.targetDate}/${r.releasedAt}`;check(!revisions.has(identity),'ambiguous duplicate release');revisions.add(identity);return{targetDate:r.targetDate,releasedAt:r.releasedAt,value:nullable(r.value,'released value')};});
 const available=vintages.filter(v=>utcDay(v.issuedAt)<=cutoff),known=releases.filter(r=>utcDay(r.releasedAt)<=cutoff);
 // Hidden future vintages/releases must not even leak their target dates into this view.
 const targets=[...new Set([...available.flatMap(v=>v.values.map(p=>p.targetDate)),...known.map(r=>r.targetDate)])].sort();
 const actuals=targets.map(targetDate=>{const rows=known.filter(r=>r.targetDate===targetDate).sort((a,b)=>a.releasedAt.localeCompare(b.releasedAt)),r=rows.at(-1);return{targetDate,value:r?.value??null,releasedAt:r?.releasedAt??null,state:!r?'not-released':r.value===null?'withdrawn':'released',revisionCount:rows.length};});
 return{modelVersion:EXPECTATIONS_VERSION,asOf:input.asOf,method:'latest-available-release-per-observation',vintages:available,actuals};
}

/** Quotes at one observation date across nonuniform remaining maturities.
 * No interpolation, discount-factor model or implied future-rate forecast is created.
 */
export function maturityCurves(input){
 object(input,['tenors','snapshots','kind','unit'],'maturity curves');check(['par','spot','quoted'].includes(input.kind),'kind must be par, spot or quoted');check(input.unit==='percent-per-year','unit must be percent-per-year');
 list(input.tenors,2,120,'tenors');list(input.snapshots,1,100,'snapshots');let previous=0,previousYears=0;
 const tenors=input.tenors.map(t=>{object(t,['months','label'],'tenor');const months=num(t.months,'tenor months');check(months>previous&&months<=1200,'maturities must strictly increase in (0,1200] months');const years=months/12;check(years>previousYears,'maturity normalization underflow or collapse');previous=months;previousYears=years;return{months,years,label:label(t.label,'tenor label')};});
 let last=-Infinity;const snapshots=input.snapshots.map(s=>{object(s,['date','values'],'curve snapshot');const day=utcDay(s.date);check(day>last,'snapshot dates must strictly increase');last=day;check(Array.isArray(s.values)&&s.values.length===tenors.length,'each snapshot needs every tenor, with null for missing');return{date:s.date,values:tenors.map((t,i)=>({...t,value:nullable(s.values[i],'quoted yield')}))};});
 return{modelVersion:EXPECTATIONS_VERSION,kind:input.kind,unit:input.unit,xMeaning:'remaining maturity in years, not a future observation date',interpolation:'none',tenors,snapshots};
}

/** Empirical type-7 quantile: h=(n-1)p, linear interpolation between adjacent ranks.
 * The caller supplies equal-weight scenarios; these are not probability forecasts.
 */
function quantile(sorted,p){const h=(sorted.length-1)*p,lo=Math.floor(h),hi=Math.ceil(h),a=sorted[lo],b=sorted[hi];return num(Math.max(a,Math.min(b,a+(b-a)*(h-lo))),'empirical quantile');}
export function scenarioEnvelope(input){
 object(input,['history','scenarios','band'],'scenario envelope');const history=datedValues(input.history),origin=history.at(-1);check(origin.value!==null,'scenario origin needs an observed value');list(input.scenarios,2,100,'scenarios');
 object(input.band,['kind','lower','upper'],'band');check(['range','quantile'].includes(input.band.kind),'band kind must be range or quantile');
 if(input.band.kind==='range')check(input.band.lower===undefined&&input.band.upper===undefined,'range has no percentile parameters');else check(typeof input.band.lower==='number'&&typeof input.band.upper==='number'&&input.band.lower>=0&&input.band.upper<=1&&input.band.lower<input.band.upper,'quantile bounds must satisfy 0 ≤ lower < upper ≤ 1');
 const ids=new Set();let dateGrid;
 const scenarios=input.scenarios.map(s=>{object(s,['id','label','values'],'scenario');label(s.id,'scenario id');label(s.label,'scenario label');check(!ids.has(s.id),'duplicate scenario id');ids.add(s.id);const values=datedValues(s.values);check(values.length>=2&&values[0].date===origin.date&&values[0].value===origin.value,'every scenario must begin at the observed origin');const grid=values.map(v=>v.date);if(dateGrid)check(JSON.stringify(grid)===JSON.stringify(dateGrid),'scenarios need the same explicit date grid; use null for missing');else dateGrid=grid;return{id:s.id,label:s.label,values,weight:1/input.scenarios.length};});
 const observations=dateGrid.map((date,i)=>{const values=scenarios.map(s=>s.values[i].value),complete=values.every(v=>v!==null),sorted=complete?[...values].sort((a,b)=>a-b):null;return{date,count:values.filter(v=>v!==null).length,complete,lower:!complete?null:input.band.kind==='range'?sorted[0]:quantile(sorted,input.band.lower),upper:!complete?null:input.band.kind==='range'?sorted.at(-1):quantile(sorted,input.band.upper),median:!complete?null:quantile(sorted,.5),missing:complete?null:'incomplete-scenario-set'};});
 return{modelVersion:EXPECTATIONS_VERSION,origin,history,scenarios,band:{...input.band,method:input.band.kind==='range'?'supplied-scenario-min-max':'equal-weight-empirical-type-7'},observations,weighting:'equal scenario weights',interpretation:'descriptive range or quantiles of supplied scenarios; no likelihood, confidence or coverage claim',missingPolicy:'all supplied scenarios required at each date; no changing denominator'};
}
