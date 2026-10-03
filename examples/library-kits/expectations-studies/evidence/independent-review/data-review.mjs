// Independent reviewer checks. Run from any directory; no renders or browser work.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {vintageSnapshot,scenarioEnvelope,maturityCurves} from '../../../../../engine/lib/expectations.mjs';
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;},near=(a,b)=>{assert(Math.abs(a-b)<1e-9);n++;};
const vintages=[{id:'jan',issuedAt:'2024-01-01',values:[{targetDate:'2024-03-01',value:101},{targetDate:'2024-06-01',value:null}]},{id:'jul',issuedAt:'2024-07-01',values:[{targetDate:'2025-01-01',value:9999}]}];
const releases=[{targetDate:'2024-03-01',releasedAt:'2024-06-15',value:0},{targetDate:'2024-03-01',releasedAt:'2024-04-01',value:100},{targetDate:'2024-03-01',releasedAt:'2024-05-01',value:null},{targetDate:'2024-06-01',releasedAt:'2024-06-02',value:-2},{targetDate:'2024-08-01',releasedAt:'2024-09-01',value:12345}];
for(const [asOf,value,state,revisions] of [['2024-03-31',null,'not-released',0],['2024-04-01',100,'released',1],['2024-05-01',null,'withdrawn',2],['2024-06-15',0,'released',3]]){
 const got=vintageSnapshot({asOf,vintages,releases});eq(got.vintages.map(x=>x.id),['jan']);const p=got.actuals.find(x=>x.targetDate==='2024-03-01');eq([p.value,p.state,p.revisionCount],[value,state,revisions]);eq(got.actuals.some(x=>x.targetDate==='2025-01-01'),false);eq(got.actuals.some(x=>x.targetDate==='2024-08-01'),false);
 eq(got,vintageSnapshot({asOf,vintages:vintages.slice(0,1),releases:releases.filter(x=>x.releasedAt<=asOf)}));
}
for(const asOf of ['2023-01-01','2023-12-31']){const got=vintageSnapshot({asOf,vintages,releases});eq(got.vintages,[]);eq(got.actuals,[]);}
const curve=maturityCurves({kind:'spot',unit:'percent-per-year',tenors:[{months:1,label:'1m'},{months:12,label:'1y'},{months:360,label:'30y'}],snapshots:[{date:'2024-01-01',values:[-1,null,4]},{date:'2024-01-02',values:[null,null,null]}]});eq(curve.tenors.map(x=>x.years),[1/12,1,30]);eq(curve.snapshots[1].values.map(x=>x.value),[null,null,null]);
for(let count=2;count<=25;count++)for(const lower of [0,.1,.25,.5]){
 const values=Array.from({length:count},(_,i)=>((i*17+count*13)%71)-35).sort((a,b)=>a-b),upper=1-lower/2;
 const scenarios=values.map((v,i)=>({id:'s'+i,label:'Scenario '+i,values:[{date:'2024-01-01',value:100},{date:'2024-02-01',value:v},{date:'2024-03-01',value:i===0?null:v},{date:'2024-04-01',value:v}]}));
 const result=scenarioEnvelope({history:[{date:'2023-12-01',value:null},{date:'2024-01-01',value:100}],scenarios,band:{kind:'quantile',lower,upper}});
 const q=p=>{const x=(count-1)*p,i=Math.floor(x);return values[i]+(values[Math.ceil(x)]-values[i])*(x-i);};
 for(const i of [1,3]){near(result.observations[i].lower,q(lower));near(result.observations[i].upper,q(upper));near(result.observations[i].median,q(.5));eq(result.observations[i].count,count);}
 eq([result.observations[2].lower,result.observations[2].upper,result.observations[2].median],[null,null,null]);eq(result.observations[2].count,count-1);eq(result.observations[0].median,100);near(result.scenarios.reduce((a,s)=>a+s.weight,0),1);
}
assert.equal(n,1178);
const originalAssertions=n;
for(const months of [[Number.MIN_VALUE,2*Number.MIN_VALUE],[.01183612462332408,.011836124623324082]]){
 assert.throws(()=>maturityCurves({kind:'quoted',unit:'percent-per-year',tenors:months.map((months,i)=>({months,label:'t'+i})),snapshots:[{date:'2024-01-01',values:[1,2]}]}),/normalization underflow or collapse/);n++;
}
for(const value of [Number.MIN_VALUE,-Number.MIN_VALUE,1e12,-1e12])for(const lower of [.172,.25]){
 const result=scenarioEnvelope({history:[{date:'2024-01-01',value:100}],scenarios:[0,1].map(i=>({id:'s'+i,label:'Equal '+i,values:[{date:'2024-01-01',value:100},{date:'2024-02-01',value}]})),band:{kind:'quantile',lower,upper:.75}});
 for(const k of ['lower','upper','median'])eq(result.observations[1][k],value);
}
const sourceUrl=new URL('../../../../../engine/lib/expectations.mjs',import.meta.url);
const report={status:'pass',assertions:n,originalAssertions,regressionAssertions:n-originalAssertions,source:'engine/lib/expectations.mjs',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(sourceUrl)).digest('hex'),scope:['Inclusive cutoff and shuffled actual-release revisions','Null withdrawal, zero rerelease, and hidden-future-prefix invariance','Nonuniform maturity normalization and all-null snapshots','Independent type-7 quantiles for 2–25 scenarios and four percentile pairs','Fixed scenario denominator, missing band and recovery','Two rejected maturity underflow/collapse counterexamples','Twenty-four exact equal-value quantile regressions at subnormal and bounded extremes'],resolvedFindings:['Positive distinct month tenors could become zero or duplicate normalized years; strict normalized-year monotonicity now rejects them.','Weighted endpoint interpolation could underflow equal subnormal values or round equal boundary values out of bounds; difference interpolation with rank clamping now preserves them.'],limits:'Source/math validation and finite counterexamples; no continuous playback or interactive browser acceptance.'};
fs.writeFileSync(new URL('data-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
