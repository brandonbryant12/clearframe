import test from 'node:test';import assert from 'node:assert/strict';
import {rebaseSeries,decomposeProduct,reconcileStock} from '../engine/lib/data-transforms.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('rebasing uses an observed positive anchor and actual elapsed days, preserving gaps and input',()=>{
  const input={baseDate:'2024-02-28',baseIndex:100,observations:[{date:'2024-02-27',value:8},{date:'2024-02-28',value:10},{date:'2024-02-29',value:null},{date:'2024-03-01',value:15}]};
  const original=structuredClone(input),r=rebaseSeries(input);
  assert.deepEqual(r.observations.map(p=>[p.elapsedDays,p.index]),[[-1,80],[0,100],[1,null],[2,150]]);assert.deepEqual(input,original);
  for(const edit of [{baseDate:'2024-02-29'},{baseDate:'2024-03-02'},{baseIndex:0},{observations:[{date:'2024-02-30',value:2}]},{observations:[{date:'2024-02-28',value:0}]}])assert.throws(()=>rebaseSeries({...input,...edit}));
});
test('product attribution reconciles mixed directions, the interaction, and unreinvested cash',()=>{
  const r=decomposeProduct({first:{id:'earnings',label:'Earnings',start:10,end:11},second:{id:'multiple',label:'Multiple',start:20,end:18},additions:[{id:'income',label:'Cash income',amount:4}]});
  assert.equal(r.opening,200);assert.equal(r.endingProduct,198);assert.equal(r.combinedValue,202);assert.equal(r.change,2);near(r.changeFraction,.01);
  assert.deepEqual(r.parts.map(p=>p.amount),[20,-20,-2,4]);near(r.parts.reduce((s,p)=>s+p.fraction,0),.01);assert.equal(r.arithmeticDifference,0);
  const decline=decomposeProduct({first:{id:'volume',label:'Volume',start:100,end:80},second:{id:'price',label:'Price',start:50,end:40}});
  assert.deepEqual(decline.parts.map(p=>p.amount),[-1000,-1000,200]);assert.equal(decline.change,-1800);near(decline.changeFraction,-.36);
  assert.throws(()=>decomposeProduct({first:{id:'a',label:'A',start:0,end:2},second:{id:'b',label:'B',start:2,end:4}}));
});
test('stock reconciliation preserves unexplained differences and zero residuals separately from supplied flows',()=>{
  const c=[{id:'subscriptions',label:'Subscriptions',amount:40},{id:'redemptions',label:'Redemptions',amount:-25},{id:'valuation',label:'Valuation',amount:-8}];
  const r=reconcileStock({opening:120,closing:132,components:c});
  assert.equal(r.suppliedNetChange,7);assert.equal(r.explainedClosing,127);assert.equal(r.residual,5);assert.equal(r.netChange,12);
  assert.equal(r.opening+r.components.reduce((s,p)=>s+p.amount,0),r.closing);assert.equal(c.length,3);
  assert.equal(reconcileStock({opening:120,closing:127,components:c}).residual,0);
  assert.equal(reconcileStock({opening:0,closing:-2,components:[]}).residual,-2);
  assert.throws(()=>reconcileStock({opening:0,closing:1,components:[{id:'residual',label:'Flow',amount:1}]}));
  assert.throws(()=>reconcileStock({opening:0,closing:NaN,components:[]}));
});
