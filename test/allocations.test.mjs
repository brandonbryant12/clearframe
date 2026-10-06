import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{allocationPlan,allocationClock,allocationState,allocationAmount}from'../film/allocation-data.mjs';import{allocationScene}from'../film/allocations.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('../test/fixtures/allocation-inputs.json',import.meta.url))).cases.map(({id,...c})=>c);
test('allocation preserves exact units, source availability and token identities through round trips',()=>{
 const original=structuredClone(fixtures[1]),m=allocationPlan(original);assert.deepEqual(original,fixtures[1]);assert.deepEqual(m.after.map(b=>b.count),[8,8,8]);assert.equal(m.totalMinorUnits,48);assert.equal(m.grossTransfers,8);assert.equal(m.changedOwners,4);assert.equal(new Set(m.tokens.map(t=>t.id)).size,24);assert.deepEqual(m.after.map(b=>b.shareLabel),['≈33.3%','≈33.3%','≈33.3%']);
 assert.deepEqual(m.tokens.filter(t=>t.initialBucket==='quality').map(t=>t.finalBucket),Array(8).fill('quality'));
 const c=structuredClone(fixtures[0]);c.moves=[{from:'bills',to:'buffer',count:1},{from:'buffer',to:'bills',count:1}];const scene=allocationScene(c,{width:1920,height:1080,id:'round-trip'});assert.deepEqual(scene.model.before,scene.model.after);assert.equal(scene.props.elements.find(e=>e.id==='round-trip-finished').text,'After · all transfers complete');
});
test('departure and arrival have explicit half-open accounting states at every event',()=>{
 const m=allocationPlan(fixtures[0]),c=allocationClock(m);assert.equal(c.duration,22);
 for(const e of c.events){const before=allocationState(m,c,e.start-1e-8),moving=allocationState(m,c,e.start),arrived=allocationState(m,c,e.end);assert.deepEqual(before.counts,e.before);assert.deepEqual(moving.counts,e.inTransit);assert.equal(moving.inTransit,1);assert.deepEqual(arrived.counts,e.after);assert.equal(arrived.inTransit,0);for(const s of[before,moving,arrived]){assert.equal(s.total,20);assert.equal(s.minorUnits.reduce((a,b)=>a+b,0)+s.transitMinorUnits,200000);}}
 const r=allocationScene(fixtures[0],{width:1920,height:1080,id:'retimed',timing:{initialHold:5,moveSeconds:4,settleSeconds:1,finalHold:8}});assert.equal(r.duration,33);assert.equal(r.geometry.routes[0].legs[0].start,5);assert.equal(r.clock.events[0].end,9);assert.equal(r.props.elements.find(e=>e.id==='retimed-amount-1-bills').at,5);assert.equal(r.props.elements.find(e=>e.id==='retimed-amount-2-buffer').at,9);
});
test('allocation rejects invented precision, overdraws, sparse plans and ambiguous groups',()=>{
 for(const edit of [c=>c.quantum.minorUnits=10001,c=>c.buckets[0].count=.5,c=>c.moves[0].count=13,c=>c.moves[0].to=c.moves[0].from,c=>c.moves[0].from=['bills'],c=>c.moves[0].to=['buffer'],c=>delete c.moves[0],c=>c.buckets[1].label=' Bills ',c=>c.moves[0].extra=true,c=>c.asOf='2026-02-30']){const c=structuredClone(fixtures[0]);edit(c);assert.throws(()=>allocationPlan(c),/allocation|date/);}
 const c=structuredClone(fixtures[0]);c.quantum={minorUnits:125,decimals:2,displayDecimals:2,unit:'units'};assert.equal(allocationAmount(allocationPlan(c).totalMinorUnits,c.quantum),'25.00 units');
});
test('native trays keep one constant-size token and translation-only tracks for both layouts',()=>{
 for(const input of fixtures)for(const [width,height]of[[1920,1080],[1080,1920]]){const r=allocationScene(input,{width,height,id:'trays'}),tokens=r.props.elements.filter(e=>e.id.startsWith('trays-token-'));assert.equal(tokens.length,r.model.total);for(const t of tokens){assert.equal(t.w,r.geometry.size);assert.equal(t.h,r.geometry.size);assert.equal(t.enter,'none');for(const k of t.keys)assert.deepEqual(Object.keys(k).sort(),['at','dur','ease','x','y']);}for(const t of r.model.tokens){const card=r.geometry.cards.find(c=>c.id===t.finalBucket),p=r.geometry.finalPositions[t.id];assert(p[0]>=card.x&&p[0]+r.geometry.size<=card.x+card.width);assert(p[1]>=card.y&&p[1]+r.geometry.size<=card.y+card.height);}}
});
test('final comparison uses shared zero-based count lengths with exact zero handling',()=>{
 const input=structuredClone(fixtures[0]);input.moves=[{from:'buffer',to:'bills',count:2}];const r=allocationScene(input,{width:1920,height:1080,id:'comparison',view:'comparison'});assert(!r.props.elements.some(e=>e.id==='comparison-after-2'));for(const [i,b]of r.model.after.entries()){const e=r.props.elements.find(e=>e.id===`comparison-after-${i}`);if(b.count){assert.equal(e.x,r.geometry.comparison.left);assert.equal(e.w,r.geometry.comparison.barWidth*b.count/r.model.total);}}
});
