import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const {valuationGrid}=await import(path.join(root,'fframes/valuation-data.mjs'));
const {valuationScene,valuationColor}=await import(path.join(root,'fframes/valuations.mjs'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let comparisons=0,rejections=0,geometryChecks=0;
const near=(a,b)=>{assert.ok(Math.abs(a-b)<=Math.max(1e-9,Math.abs(b)*1e-12),`${a} vs ${b}`);comparisons++};
// Integer percentages permit an independent exact rational reference per period.
const ref=(base,g,r,n)=>{let out=0;for(let t=1;t<=n;t++)out+=Number(BigInt(base)*BigInt(100+g)**BigInt(t))/Number(BigInt(100+r)**BigInt(t));return out};
const base={title:'Independent model',source:'Fictional check',asOf:'2026-09-30',unit:'USD',cashFlowNow:100,initialOutlay:100,timing:'annual-end',terminal:{kind:'none',periods:5},growthRates:[-20,0,20,40],discountRates:[-10,0,20,50],rateDecimals:0,selected:{growth:0,discount:20},slice:'discount',scale:{min:-1e12,max:1e12,ticks:[-1e12,0,1e12],decimals:2}};
for(const cash of [-100,0,100])for(const outlay of [0,100,1000])for(const periods of [1,2,5,12,30])for(const slice of ['growth','discount']){
 const input={...base,cashFlowNow:cash,initialOutlay:outlay,terminal:{kind:'none',periods},slice},m=valuationGrid(input);
 for(const c of m.cells){assert.equal(c.valid,true);near(c.presentValue,ref(cash,c.growth,c.discount,periods));near(c.value,ref(cash,c.growth,c.discount,periods)-outlay);assert.equal(c.terms.length,periods);for(const t of c.terms){near(t.cashFlow,Number(BigInt(cash)*BigInt(100+c.growth)**BigInt(t.year))/Number(100n**BigInt(t.year)));near(t.presentValue,ref(cash,c.growth,c.discount,t.year)-ref(cash,c.growth,c.discount,t.year-1));}}
 assert.equal(m.slice.points.length,slice==='growth'?4:4);for(const p of m.slice.points){assert.equal(p[slice==='growth'?'discount':'growth'],m.selected[slice==='growth'?'discount':'growth']);assert.deepEqual(m.cells.find(c=>c.row===p.row&&c.column===p.column),Object.fromEntries(Object.entries(p).filter(([k])=>k!=='x')));comparisons+=2;}
}
for(const cash of [-100,0,100])for(const outlay of [0,100,1000])for(const slice of ['growth','discount']){
 const m=valuationGrid({...base,cashFlowNow:cash,initialOutlay:outlay,terminal:{kind:'growing-perpetuity'},slice});for(const c of m.cells){assert.equal(c.valid,c.discount>c.growth);if(c.valid){near(c.presentValue,cash*(100+c.growth)/(c.discount-c.growth));near(c.value,cash*(100+c.growth)/(c.discount-c.growth)-outlay)}else{assert.equal(c.value,null);assert.equal(c.presentValue,null);assert.equal(c.reason,'discount-not-above-growth');comparisons+=3;}}
}
const reject=mut=>{const b=structuredClone(base);mut(b);assert.throws(()=>valuationGrid(b));rejections++};
for(const f of [b=>b.foo=1,b=>b.cashFlowNow=Infinity,b=>b.cashFlowNow=NaN,b=>b.cashFlowNow=1e-10,b=>b.initialOutlay=-1,b=>b.initialOutlay=1e13,b=>b.timing='annual-start',b=>b.terminal.kind='other',b=>b.terminal.periods=0,b=>b.terminal.periods=121,b=>b.terminal.periods=1.2,b=>b.terminal={kind:'growing-perpetuity',periods:5},b=>b.growthRates=[0,0],b=>b.discountRates=[2,1],b=>delete b.growthRates[1],b=>delete b.discountRates[1],b=>delete b.scale.ticks[1],b=>b.rateDecimals=7,b=>b.growthRates=[0,.1],b=>b.selected.growth=1,b=>b.slice='both',b=>b.scale.ticks=[-1e12,1e12],b=>b.scale.ticks=[0,1],b=>b.scale.min=b.scale.max,b=>b.scale.decimals=5,b=>b.scale={min:0,max:1,ticks:[0,1],decimals:0}])reject(f);
const uneven={...base,cashFlowNow:1e6,initialOutlay:0,terminal:{kind:'none',periods:1},growthRates:[0,10],discountRates:[0,20,100],selected:{growth:0,discount:20},scale:{min:0,max:2e6,ticks:[0,1e6,2e6],decimals:4}};
const us=valuationScene(uneven,{width:1920,height:1080,id:'uneven',view:'grid'});for(const c of us.geometry.cells){const e=us.props.elements.find(e=>e.id===`uneven-value-${c.row}-${c.column}`);near(e.x,c.box[0]+c.box[2]/2);assert.ok(e.x-e.fit/2>=c.box[0]&&e.x+e.fit/2<=c.box[0]+c.box[2]);geometryChecks++;}
for(const [mut,view]of [[b=>{b.discountRates=[0,1,100];b.selected.discount=1},'grid'],[b=>{b.discountRates=[0,1,100];b.selected.discount=1},'slice'],[b=>{b.growthRates=[0,1,100];b.selected.growth=0},'grid'],[b=>{b.scale.ticks=[0,1,2e6]},'slice']]){const b=structuredClone(uneven);mut(b);assert.throws(()=>valuationScene(b,{width:1920,height:1080,id:'crowded',view}));rejections++;}
const cases=JSON.parse(fs.readFileSync(path.join(root,'examples/library-kits/valuation-studies/inputs.json'))).cases;
for(const {id,...input}of cases)for(const [width,height]of [[1920,1080],[1080,1920]])for(const view of ['grid','slice']){
 const s=valuationScene(input,{width,height,id:'independent',view,reveal:true});
 for(const c of s.geometry.cells){const e=s.props.elements.find(x=>x.id===`independent-value-${c.row}-${c.column}`);assert.ok(e.x-e.fit/2>=c.box[0]);assert.ok(e.x+e.fit/2<=c.box[0]+c.box[2]);assert.equal(c.fill,valuationColor(c.value,input.scale));assert.equal(c.label,c.value===null?'—':c.value.toFixed(input.scale.decimals));geometryChecks+=4;}
 const valid=s.geometry.points.filter(p=>p.valid);for(const p of valid){const [x,y]=p.point;near(x,width*.2+(p.x-s.model.slice.points[0].x)/(s.model.slice.points.at(-1).x-s.model.slice.points[0].x)*width*.69);near(y,height*(height>width?.72:.745)-(p.value-input.scale.min)/(input.scale.max-input.scale.min)*height*(height>width?.36:.34));geometryChecks+=2;}for(const p of s.geometry.points.filter(p=>!p.valid)){assert.equal(p.point,null);geometryChecks++;}
 for(const seg of s.geometry.segments){const a=valid.find(p=>p.point[0]===seg.p1[0]),b=valid.find(p=>p.point[0]===seg.p2[0]);assert.ok(a&&b);assert.equal(s.geometry.points.indexOf(b)-s.geometry.points.indexOf(a),1);assert.ok(seg.end>seg.at);geometryChecks+=3;}
}
const report={status:'pass',comparisons,rejections,geometryChecks,method:'Exact BigInt integer-ratio period reference, supported cases and negative/zero inputs; source geometry, not encoded pixels',sourceHashes:Object.fromEntries(['fframes/valuation-data.mjs','fframes/valuations.mjs','examples/library-kits/valuation-studies/inputs.json'].map(p=>[p,sha(path.join(root,p))]))};fs.writeFileSync(path.join(here,'contract-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
