import test from 'node:test';import assert from 'node:assert/strict';
import {deflateSeries,growthSeries,rollingStatistics,drawdownSeries} from '../engine/lib/time-series.mjs';
const monthly=v=>v.map((value,i)=>({date:`2024-${String(i+1).padStart(2,'0')}-01`,value}));
const close=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('deflation uses the dated index ratio, preserving sign, deflation and missingness',()=>{
 const r=deflateSeries({baseDate:'2020-01-01',observations:[{date:'2020-01-01',nominal:100,priceIndex:200},{date:'2021-01-01',nominal:120,priceIndex:240},{date:'2022-01-01',nominal:-90,priceIndex:180},{date:'2023-01-01',nominal:100,priceIndex:null},{date:'2024-01-01',nominal:null,priceIndex:220}]});
 assert.deepEqual(r.observations.map(p=>p.real),[100,100,-100,null,null]);assert.equal(r.observations[1].gap,20);
 assert.throws(()=>deflateSeries({baseDate:'2021-01-01',observations:[{date:'2020-01-01',nominal:1,priceIndex:0},{date:'2021-01-01',nominal:1,priceIndex:1}]}),/positive/);
});
test('growth separates lagged change, annualized pace and percentage-point changes',()=>{
 const q={frequency:'quarterly',lag:1,annualize:true,observations:[{date:'2023-12-31',value:100},{date:'2024-03-31',value:105},{date:'2024-06-30',value:105},{date:'2024-09-30',value:0}]};
 const r=growthSeries(q).observations;close(r[1].change,.05);close(r[1].annualized,1.05**4-1);close(r[2].changeInGrowth,-(1.05**4-1));assert.equal(r[3].annualized,-1);
 const g=growthSeries({frequency:'monthly',lag:2,annualize:false,observations:monthly([100,null,121,125])}).observations;
 close(g[2].change,.21);assert.equal(g[3].change,null);assert.equal(g[2].changeInGrowth,null);
 const z=growthSeries({frequency:'monthly',lag:1,annualize:false,observations:monthly([0,10,-2,4])}).observations;
 assert.deepEqual(z.map(p=>p.missing),['warmup','nonpositive-base','negative-ending-level','nonpositive-base']);
});
test('period validation handles month ends and leap years, and rejects omitted periods',()=>{
 const observations=[{date:'2024-01-31',value:10},{date:'2024-02-29',value:11},{date:'2024-03-31',value:12}];
 assert.equal(growthSeries({observations,frequency:'monthly',lag:1,annualize:false}).observations.length,3);
 assert.throws(()=>growthSeries({observations:[observations[0],observations[2]],frequency:'monthly',lag:1,annualize:false}),/explicit null/);
 assert.throws(()=>growthSeries({observations:monthly([1,2]),frequency:'monthly',lag:0,annualize:false}),/lag/);
 assert.throws(()=>growthSeries({observations:monthly([1,2]),frequency:'monthly',lag:1}),/annualize/);
});
test('rolling sample SD uses complete windows and a fixed n-minus-one denominator',()=>{
 const r=rollingStatistics({frequency:'monthly',window:3,observations:monthly([2,4,6,null,8,10,12])}).observations;
 assert.deepEqual(r.map(p=>p.complete),[false,false,true,false,false,false,true]);assert.equal(r[2].mean,4);assert.equal(r[2].standardDeviation,2);assert.equal(r[4].count,2);assert.equal(r[4].mean,null);assert.equal(r[6].standardDeviation,2);
 const large=rollingStatistics({frequency:'monthly',window:3,observations:monthly([1e10+2,1e10+4,1e10+6])});assert.equal(large.observations[2].standardDeviation,2);
});
test('observed drawdowns retain equal-peak dates, recovery and unfinished episodes across gaps',()=>{
 const r=drawdownSeries({frequency:'monthly',observations:monthly([100,100,80,null,90,100,120,60,90])});
 close(r.maxDrawdown,-.5);close(r.currentDrawdown,-.25);assert.equal(r.observations[3].drawdown,null);
 assert.equal(r.episodes.length,2);assert.equal(r.episodes[0].peakDate,'2024-02-01');assert.equal(r.episodes[0].recoveryDate,'2024-06-01');assert.equal(r.episodes[0].recovered,true);assert.equal(r.episodes[1].recovered,false);assert.equal(r.episodes[1].recoveryDate,null);
 const tail=drawdownSeries({frequency:'monthly',observations:monthly([0,10,0,null])});assert.equal(tail.observations[0].drawdown,null);assert.equal(tail.maxDrawdown,-1);assert.equal(tail.currentDrawdown,null);
});

test('custom source attribution must identify static native text, with an auditable source record',async()=>{
 const {normalizeProps}=await import('../fframes/catalog.mjs');
 const props={sourceElement:'credit',elements:[{id:'credit',type:'text',text:'Fictional monthly records · 2024',x:120,y:950,size:48,fill:'ink',at:0,enter:'none'}]};
 assert.equal(normalizeProps('canvas',props,{width:1920,height:1080}).sourceElement,'credit');
 for(const mutation of [{id:'wrong'},{text:''},{at:1},{enter:'fade'},{opacity:0},{fill:'bg'},{blur:60},{mosaic:true},{rough:true},{shine:true},{size:20},{exit:'fade'},{keys:[]},{type:'rect'}])
  assert.throws(()=>normalizeProps('canvas',{...props,elements:[{...props.elements[0],...mutation}]},{width:1920,height:1080}),/sourceElement/);
 assert.throws(()=>normalizeProps('canvas',{...props,source:'duplicate'},{width:1920,height:1080}),/sourceElement/);
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
 const {loadStoryboard}=await import('../engine/lib/project.mjs'),{computeTiming}=await import('../engine/lib/timing.mjs'),{createJob}=await import('../fframes/job.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cf-source-element-'));
 try{
  const sb={format:{preset:'landscape'},music:false,captions:false,sources:[],beats:[{id:'sourced',block:'canvas',duration:6,props}]};
  const compile=()=>{fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb));return createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});};
  assert(compile().errors.some(e=>e.includes('sourceElement requires')));
  sb.sources=[{claim:'Fictional monthly records',source:'original fixture',asOf:'2024-12-31'}];
  assert.deepEqual(compile().errors,[]);assert(!compile().warnings.some(w=>w.includes('add a visible source')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}

});
