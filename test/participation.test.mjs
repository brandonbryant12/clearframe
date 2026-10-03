import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeMembership,benchmarkDifferences} from '../engine/lib/data-transforms.mjs';
test('membership count and weights keep missing observations and zero weights in explicit full denominators',()=>{
 const input={membershipDate:'2026-09-01',metricAsOf:'2026-09-30',condition:{operator:'gte',threshold:10},members:[
  {id:'a',label:'A',value:10,weight:70},{id:'b',label:'B',value:9,weight:20},{id:'c',label:'C',value:null,weight:10},{id:'d',label:'D',value:11,weight:0}]};
 const original=structuredClone(input),r=summarizeMembership(input);
 assert.deepEqual(r.groups,[{state:'meets',count:2,weight:70,countFraction:.5,weightFraction:.7},{state:'other',count:1,weight:20,countFraction:.25,weightFraction:.2},{state:'missing',count:1,weight:10,countFraction:.25,weightFraction:.1}]);
 assert.equal(r.observedCount,3);assert.equal(r.observedWeight,90);assert.deepEqual(input,original);
 assert.equal(summarizeMembership({...input,condition:{operator:'gt',threshold:10}}).groups[0].count,1);
 assert.equal(summarizeMembership({...input,condition:{operator:'lt',threshold:10}}).groups[0].count,1);
 assert.equal(summarizeMembership({...input,condition:{operator:'lte',threshold:10}}).groups[0].count,2);
 assert.throws(()=>summarizeMembership({...input,members:input.members.map(m=>({...m,weight:0}))}));
 assert.throws(()=>summarizeMembership({...input,members:[input.members[0],input.members[0]]}));
 assert.throws(()=>summarizeMembership({...input,membershipDate:'2026-02-29'}));
});
test('benchmark differences preserve negative values, exact equality, missing metrics and true zero size',()=>{
 const r=benchmarkDifferences({benchmark:4,items:[{id:'a',label:'A',value:8,size:50},{id:'b',label:'B',value:-2,size:450},{id:'c',label:'C',value:4,size:0},{id:'d',label:'D',value:null,size:20}]});
 assert.deepEqual(r.items.map(p=>p.difference),[4,-6,0,null]);assert.deepEqual(r.items.map(p=>p.size),[50,450,0,20]);
 assert.equal(benchmarkDifferences({benchmark:-1,items:[{id:'a',label:'A',value:-3}]}).items[0].difference,-2);
 assert.throws(()=>benchmarkDifferences({benchmark:4,items:[{id:'a',label:'A',value:2,size:-1}]}));
 assert.throws(()=>benchmarkDifferences({benchmark:4,items:[{id:'a',label:'A',value:Infinity}]}));
});
