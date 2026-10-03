// Prepare two domains in deliberately composed frame shapes; rendering is a separate command.
import fs from 'node:fs';
import { accountLedger } from '../../engine/lib/finance.mjs';
const root=new URL('./',import.meta.url);
const ledger=accountLedger({openingBalance:0,cashflowTiming:'end',periods:Array.from({length:30},(_,i)=>({label:`Year ${i+1}`,returnRate:.06,employee:6000,employer:3000}))});
const retirement={title:'Contributions are only one part',asOf:'2026-10-02',source:'Hypothetical model · 6% yearly return; no forecast',
  x:{type:'linear',label:'Years · end-of-year contributions',domain:[0,30],ticks:[0,10,20,30]},
  y:{type:'linear',label:'Balance · USD thousands',domain:[0,800],ticks:[0,200,400,600,800]},
  series:[{id:'balance',label:'Account balance',values:[{x:0,y:0},...ledger.rows.map((r,i)=>({x:i+1,y:r.closing/1000}))]},
    {id:'contributed',label:'Contributions',values:Array.from({length:31},(_,i)=>({x:i,y:i*9}))}],
  motion:{at:.5,duration:4}};
const operations={title:'An absent reading is not zero',asOf:'2026-10-02',source:'Hypothetical monitoring example · no measured site data',
  x:{type:'date',label:'Observation date · UTC',domain:['2026-01-01','2026-04-01'],ticks:['2026-01-01','2026-02-01','2026-03-01','2026-04-01'],dateFormat:'month'},
  y:{type:'linear',label:'Temperature · degrees C',domain:[-10,30],ticks:[-10,0,10,20,30]},
  series:[{id:'north',label:'North sensor',values:[{x:'2026-01-01',y:3},{x:'2026-01-12',y:-2},{x:'2026-02-01',y:null},{x:'2026-03-01',y:13},{x:'2026-04-01',y:22}]},
    {id:'south',label:'South sensor',values:[{x:'2026-01-01',y:8},{x:'2026-02-01',y:4},{x:'2026-03-01',y:17},{x:'2026-04-01',y:26}]}],motion:{at:.5,duration:4}};
for(const preset of ['landscape','vertical']){
  const monitoring=structuredClone(operations);
  // Portrait preserves the same date domain with fewer labelled ticks.
  if(preset==='vertical') monitoring.x.ticks=['2026-01-01','2026-04-01'];
  const dir=new URL(`${preset}/`,root);fs.mkdirSync(dir,{recursive:true});
  const sb={title:'Shared scales — two explanatory specimens',format:{preset,fps:30},theme:'paper',type:'geometric',motion:{preset:'gentle',intensity:.4},backdrop:'none',transition:'cut',captions:false,music:false,sfx:'off',
    sources:[{claim:'All amounts, contribution rules, returns and temperatures are fictional illustrations.',source:'examples/quantitative-plots/build.mjs',asOf:'2026-10-02'},
      {claim:'Account uses $6000 employee plus $3000 employer at each year end for 30 years, with a hypothetical 6% effective annual return and no fees or withdrawals.',source:'engine/lib/finance.mjs accountLedger; retained ledger.json',asOf:'2026-10-02'}],
    beats:[{id:'retirement-growth',block:'canvas',duration:10,camera:'none',props:{plot:retirement}},{id:'missing-observations',block:'canvas',duration:13,camera:'none',props:{plot:monitoring}}]};
  fs.writeFileSync(new URL('storyboard.json',dir),JSON.stringify(sb,null,2)+'\n');
}
fs.writeFileSync(new URL('ledger.json',root),JSON.stringify(ledger,null,2)+'\n');
console.log('Prepared retirement and monitoring examples in landscape and vertical; no rendering.');
