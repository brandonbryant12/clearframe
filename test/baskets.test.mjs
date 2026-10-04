import test from 'node:test';import assert from 'node:assert/strict';
import {fixedBasket,basketAmount} from '../fframes/basket-data.mjs';
const fixture=()=>({title:'Fixed kit',source:'Fictional test',asOf:'2026-10-03',baseDate:'2025-01-15',currency:{unit:'USD',decimals:2},budgetMinor:10000,substitutionPolicy:'none',priceBasis:'Per pack; no tax',qualification:'One illustrative basket only',items:[{id:'rice',label:'Rice',unit:'bag',quantity:2},{id:'milk',label:'Milk',unit:'carton',quantity:3},{id:'oil',label:'Oil',unit:'bottle',quantity:1}],periods:[{date:'2025-01-15',pricesMinor:{rice:450,milk:250,oil:650}},{date:'2026-01-15',pricesMinor:{rice:550,milk:300,oil:600}}]});
test('fixed basket reconciles hand-calculated pantry costs and whole purchases',()=>{
 const input=fixture(),copy=structuredClone(input),m=fixedBasket(input),[a,b]=m.periods;
 assert.deepEqual(input,copy);assert.deepEqual(a.rows.map(v=>v.lineCostMinor),[900,750,650]);assert.deepEqual(b.rows.map(v=>v.lineCostMinor),[1100,900,600]);
 assert.deepEqual([a.costMinor,b.costMinor,a.wholeBaskets,b.wholeBaskets,a.remainderMinor,b.remainderMinor],[2300,2600,4,3,800,2200]);
 assert.deepEqual(b.costIndex,{numerator:2600,denominator:2300,base:100,value:2600/2300*100});assert.equal(b.changeMinor,300);assert.equal(b.rows[2].lineChangeMinor,-50);
 for(const p of m.periods){assert.equal(p.spentMinor+p.remainderMinor,10000);assert.ok(p.remainderMinor<p.costMinor);assert.equal(p.rows.reduce((s,v)=>s+v.baseCostWeight.numerator,0),2300);}
 assert.equal(basketAmount(2300,m.currency),'23.00 USD');
});
test('a single missing component cannot become a basket total or purchasable count',()=>{
 const x=fixture();x.periods[1].pricesMinor.milk=null;const p=fixedBasket(x).periods[1];assert.equal(p.complete,false);assert.equal(p.knownSubtotalMinor,1700);assert.deepEqual(p.missingItemIds,['milk']);
 for(const k of ['costMinor','costIndex','wholeBaskets','remainderMinor','spentMinor','changeMinor','changeFraction'])assert.equal(p[k],null);
 x.baseDate='2026-01-15';assert.throws(()=>fixedBasket(x),/baseDate/);
});
test('division near the safe-integer limit remains exact',()=>{
 const x=fixture();x.budgetMinor=Number.MAX_SAFE_INTEGER;x.items=[{id:'one',label:'Unit',unit:'pack',quantity:1}];x.periods.forEach(p=>p.pricesMinor={one:7});const p=fixedBasket(x).periods[1];
 assert.equal(p.wholeBaskets,1286742750677284);assert.equal(p.remainderMinor,3);assert.equal(p.spentMinor,9007199254740988);assert.equal(basketAmount(Number.MAX_SAFE_INTEGER,{unit:'USD',decimals:2}),'90071992547409.91 USD');
});
test('fixed-composition contract rejects silent omissions, unsafe sums and substitutions',()=>{
 const rejects=[x=>delete x.periods[1].pricesMinor.oil,x=>x.periods[1].pricesMinor.rice=-1,x=>x.items[0].quantity=.5,x=>x.items[1].id='rice',x=>x.periods[1].date=x.periods[0].date,x=>x.substitutionPolicy='cheaper-brands',x=>x.periods[1].pricesMinor.extra=3,x=>x.items[0].quantity=Number.MAX_SAFE_INTEGER,x=>x.periods[0].pricesMinor={rice:0,milk:0,oil:0},x=>delete x.items[1]];
 for(const change of rejects){const x=fixture();change(x);assert.throws(()=>fixedBasket(x));}
 const x=fixture();x.periods[1].pricesMinor.rice=Number.MAX_SAFE_INTEGER;assert.throws(()=>fixedBasket(x),/safe minor-unit/);
});

import {basketScene} from '../fframes/baskets.mjs';
test('native geometry preserves known costs, equal basket tokens and each fixed budget',()=>{
 for(const [w,h] of [[1920,1080],[1080,1920]]){
  const prices=basketScene(fixture(),{width:w,height:h,id:'prices'});
  assert.equal(prices.geometry.domainMinor[1],3000);const rects=prices.geometry.rectangles;
  assert.deepEqual(rects.map(r=>r.valueMinor),[900,750,650,1100,900,600]);
  for(const r of rects)assert.ok(Math.abs(r.w/r.scaleWidth-r.valueMinor/3000)<1e-12);
  const budgets=basketScene(fixture(),{width:w,height:h,id:'budget',view:'budget'});assert.equal(budgets.geometry.tokens.length,7);
  assert.equal(new Set(budgets.geometry.tokens.map(t=>`${t.w}/${t.h}`)).size,1);
  for(const date of ['2025-01-15','2026-01-15']){const r=budgets.geometry.rectangles.filter(x=>x.date===date);assert.equal(r.reduce((s,v)=>s+v.valueMinor,0),10000);assert.ok(Math.abs(r.reduce((s,v)=>s+v.w,0)-r[0].scaleWidth)<1e-9);}
  const zero=fixture();zero.budgetMinor=0;const empty=basketScene(zero,{width:w,height:h,id:'zero',view:'budget'});assert.equal(empty.geometry.tokens.length,0);assert.ok(empty.geometry.rectangles.every(r=>Number.isFinite(r.x)&&r.w===0));
 }
});
