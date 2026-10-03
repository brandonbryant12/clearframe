import test from 'node:test';import assert from 'node:assert/strict';
import {vintageSnapshot,maturityCurves,scenarioEnvelope} from '../engine/lib/expectations.mjs';
test('vintage snapshots retain publication identity and do not use later actual revisions',()=>{
 const input={asOf:'2024-04-15',vintages:[{id:'early',issuedAt:'2024-01-01',values:[{targetDate:'2024-03-31',value:110}]},{id:'later',issuedAt:'2024-05-01',values:[{targetDate:'2024-06-30',value:130}]}],releases:[{targetDate:'2024-03-31',releasedAt:'2024-04-01',value:100},{targetDate:'2024-03-31',releasedAt:'2024-04-30',value:105},{targetDate:'2024-03-31',releasedAt:'2024-05-31',value:null}]};
 const a=vintageSnapshot(input);assert.deepEqual(a.vintages.map(v=>v.id),['early']);assert.deepEqual(a.actuals,[{targetDate:'2024-03-31',value:100,releasedAt:'2024-04-01',state:'released',revisionCount:1}]);
 assert.equal(vintageSnapshot({...input,asOf:'2024-04-30'}).actuals[0].value,105);assert.equal(vintageSnapshot({...input,asOf:'2024-05-31'}).actuals[0].state,'withdrawn');
 const before=vintageSnapshot({...input,asOf:'2023-12-31'});assert.deepEqual(before.actuals,[]);assert.deepEqual(before.vintages,[]);
 assert.throws(()=>vintageSnapshot({...input,releases:[...input.releases,input.releases[0]]}),/duplicate/);
 assert.throws(()=>vintageSnapshot({...input,vintages:[{id:'bad',issuedAt:'2024-04-01',values:[{targetDate:'2024-03-31',value:1}]}]}),/precede/);
});
test('maturity curves preserve unequal tenor spacing, missing quotes and negative yields',()=>{
 const input={kind:'quoted',unit:'percent-per-year',tenors:[{months:1,label:'1m'},{months:12,label:'1y'},{months:60,label:'5y'}],snapshots:[{date:'2024-01-02',values:[-.5,null,2]}]};const c=maturityCurves(input);
 assert.deepEqual(c.tenors.map(t=>t.years),[1/12,1,5]);assert.deepEqual(c.snapshots[0].values.map(v=>v.value),[-.5,null,2]);assert.equal(c.interpolation,'none');
 assert.throws(()=>maturityCurves({...input,tenors:[input.tenors[1],input.tenors[0]]}),/strictly increase/);assert.throws(()=>maturityCurves({...input,snapshots:[{date:'2024-01-02',values:[1,2]}]}),/every tenor/);
 assert.throws(()=>maturityCurves({...input,tenors:[{months:Number.MIN_VALUE,label:'a'},{months:Number.MIN_VALUE*2,label:'b'}]}),/underflow/);
});
test('scenario bands use the full declared ensemble and explicit empirical quantiles, never fill a missing path',()=>{
 const input={history:[{date:'2024-01-01',value:90},{date:'2024-02-01',value:100}],band:{kind:'quantile',lower:.25,upper:.75},scenarios:[0,10,30,60].map((v,i)=>({id:`s${i}`,label:`Scenario ${i}`,values:[{date:'2024-02-01',value:100},{date:'2024-03-01',value:v},{date:'2024-04-01',value:i===1?null:v+10}]}))};const result=scenarioEnvelope(input);
 assert.equal(result.observations[1].lower,7.5);assert.equal(result.observations[1].upper,37.5);assert.equal(result.observations[1].median,20);assert.equal(result.observations[2].count,3);assert.equal(result.observations[2].lower,null);assert.equal(result.observations[2].median,null);
 const range=scenarioEnvelope({...input,band:{kind:'range'}});assert.equal(range.observations[1].lower,0);assert.equal(range.observations[1].upper,60);assert.equal(range.scenarios[0].weight,.25);
 const tiny=scenarioEnvelope({...input,scenarios:input.scenarios.map(s=>({...s,values:s.values.map((v,i)=>({...v,value:i?Number.MIN_VALUE:v.value}))}))});assert.equal(tiny.observations[1].median,Number.MIN_VALUE);assert.equal(tiny.observations[1].lower,Number.MIN_VALUE);
 assert.throws(()=>scenarioEnvelope({...input,scenarios:input.scenarios.map((s,i)=>i? s:{...s,values:[{date:'2024-02-01',value:101},...s.values.slice(1)]})}),/observed origin/);
 assert.throws(()=>scenarioEnvelope({...input,scenarios:input.scenarios.map((s,i)=>i? s:{...s,values:s.values.slice(0,2)})}),/same explicit date grid/);
});
