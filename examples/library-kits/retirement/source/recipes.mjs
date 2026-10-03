import { accountLedger, matchingContribution, vestedBalance, feeComparison, salaryServiceBenefit, purchasingPower } from '../../../../engine/lib/finance.mjs';
import { canvasBeat, frame, text, rect, line, stackedRows, reservoir, waterfall, money, percent } from './marks.mjs';
const ensure=(ok,message)=>{if(!ok)throw Error(`retirement recipe: ${message}`);};
const sourceOf=c=>`${c.source} · ${c.asOf}`;
const name=(c,suffix)=>`${c.id}-${suffix}`;

function moneyPlot(c,F,title,series,labels='Years',explicitMax) {
  const max=explicitMax??Math.max(...series.flatMap(s=>s.values.map(v=>v.y)));
  const rough=max/1000/4, power=10**Math.floor(Math.log10(rough||1));
  const step=[1,2,5,10].find(n=>n*power>=rough)*power;
  const ceiling=Math.max(step,Math.ceil(max/1000/step)*step);
  const ticks=Array.from({length:Math.round(ceiling/step)+1},(_,i)=>i*step);
  const end=Math.max(...series.flatMap(s=>s.values.map(v=>v.x)));
  ensure(end>0,'plot needs positive elapsed time');
  return {id:name(c,'trace'),block:'canvas',duration:10,camera:'none',exit:'none',props:{plot:{
    title,asOf:c.asOf,source:c.source,
    x:{type:'linear',label:labels,domain:[0,end],ticks:[0,end/2,end],decimals:end%2?1:0},
    y:{type:'linear',label:c.recipe==='R08'?'USD/month, thousands':'USD thousands',domain:[0,ceiling],ticks,prefix:'$',suffix:'k',decimals:Math.max(max<=10000?1:0,step<1?Math.ceil(-Math.log10(step)):0)},
    series:series.map(s=>({...s,values:s.values.map(v=>({...v,y:v.y/1000}))})),motion:{at:.5,duration:3.5}}}};
}
const trace=(ledger,key='closing')=>[{x:0,y:ledger.openingBalance},...ledger.rows.map((r,i)=>({x:i+1,y:r[key]}))];
function seriesLedger(c,F,ledger,title='Contributions and account value') {
  let principal=ledger.openingBalance;
  const contributed=[{x:0,y:principal},...ledger.rows.map((r,i)=>({x:i+1,y:principal+=r.employee+r.employer}))];
  return moneyPlot(c,F,title,[{id:'account',label:'Account balance',values:trace(ledger)},
    {id:'added',label:'Opening + added',values:contributed}],c.inputs.periodUnit??'Periods');
}
function signature(values){return [...values].sort((a,b)=>a-b).join('|');}

export function buildCase(c,preset='landscape') {
  ensure(c && /^[a-z][a-z0-9-]+$/.test(c.id),'case needs a slug id');
  ensure(typeof c.source==='string' && c.source.length<=105,'short explicit source required');
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(c.asOf),'asOf required');
  const F=frame(preset), p=c.inputs, source=sourceOf(c), geometry=[], beats=[];
  let audit;
  const add=result=>{beats.push(result.beat);geometry.push(...result.geometry.map(g=>({...g,beat:result.beat.id})));};
  switch(c.recipe) {
    case 'R01': {
      const ledger=accountLedger(p.account);audit={ledger};
      beats.push(seriesLedger(c,F,ledger,c.title));
      add(reservoir(ledger.rows[p.inspectPeriod],{capacity:p.capacity,showContributors:true,periodLabel:ledger.rows[p.inspectPeriod].label,title:`${ledger.rows[p.inspectPeriod].label} reconciles`,id:name(c,'flows'),source},F));
      break;
    }
    case 'R02': {
      const match=matchingContribution(p.match);audit={match};
      const rows=match.tiers.map((t,i)=>({label:`${percent(t.from)}–${percent(t.through)} pay: ${money(t.eligible)} × ${percent(t.rate)}`,
        parts:[{value:t.matched,color:i?'accent2':'accent'}]}));
      if(match.aboveMatchThreshold)rows.push({label:`Above tiers: ${money(match.aboveMatchThreshold)} × 0%`,parts:[{value:0,color:'muted'}]});
      ensure(rows.length<=4,'split more than four match bands across scenes');
      add(stackedRows(rows,{domain:p.domain,title:`${money(match.employerContribution)} employer match`,id:name(c,'tiers'),source},F));
      break;
    }
    case 'R03': {
      const current=vestedBalance(p.vesting), services=[...new Set([0,p.vesting.creditedService,p.vesting.schedule.at(-1).service])];
      const snapshots=services.map(creditedService=>({creditedService,...vestedBalance({...p.vesting,creditedService})}));
      audit={current,snapshots};
      const rows=snapshots.map(r=>({label:`${r.creditedService} service years · ${percent(r.vestedFraction)} of employer`,summary:`${money(r.totalOwned)} owned`,
        parts:[{value:r.employeeOwned,color:'accent'},{value:r.employerOwned,color:'accent2'},{value:r.employerUnvested,color:'muted'}]}));
      add(stackedRows(rows,{domain:p.vesting.employeeBalance+p.vesting.employerBalance,title:c.title,id:name(c,'ownership'),
        source:`Illustrative USD. Blue: employee; orange: employer owned; gray: unvested. Owned ≠ withdrawable. · ${c.asOf}`},F));
      break;
    }
    case 'R04': {
      const comparison=feeComparison(p.comparison);audit={comparison};
      beats.push(moneyPlot(c,F,c.title,[{id:'baseline',label:`${percent(p.comparison.baselineFeeRate)} fee`,values:trace(comparison.baseline)},
        {id:'comparison',label:`${percent(p.comparison.comparisonFeeRate)} fee`,values:trace(comparison.comparison)}],p.periodUnit));
      const parts=[{label:'Extra fees',value:comparison.chargedFeeDifference},{label:'Growth gap',value:comparison.gainDifference}];
      if(Math.abs(comparison.fundedWithdrawalDifference)>1e-8)parts.push({label:'Payout gap',value:-comparison.fundedWithdrawalDifference});
      add(waterfall(parts,{id:name(c,'fee-gap'),title:'The gap is more than fees paid',source,domain:p.gapDomain},F));
      break;
    }
    case 'R05': {
      const ledger=accountLedger(p.account);audit={ledger};
      beats.push(moneyPlot(c,F,c.title,[{id:'remaining',label:'Remaining account',values:trace(ledger)},
        {id:'unfunded',label:'Unfunded request',values:[{x:0,y:0},...ledger.rows.map((r,i)=>({x:i+1,y:r.shortfall}))]}],p.periodUnit,p.capacity));
      add(reservoir(ledger.rows[p.inspectPeriod],{capacity:p.capacity,periodLabel:ledger.rows[p.inspectPeriod].label,id:name(c,'payment'),title:'Requested is not the same as paid',source},F));
      break;
    }
    case 'R06': {
      const benefit=salaryServiceBenefit(p.benefit);audit={benefit};
      const factors=[['Annual pay',money(p.benefit.annualCompensation)],['Credited years',String(p.benefit.creditedYears)],
        ['Accrual / year',percent(p.benefit.annualAccrualRate)],['Adjustment',percent(p.benefit.adjustmentFactor)]];
      const e=[],cols=F.tall?2:4,rows=Math.ceil(4/cols),step=F.width/cols,top=F.h*.32;
      factors.forEach(([label,value],i)=>{
        const x=F.left+(i%cols)*step,y=top+Math.floor(i/cols)*F.h*.13,at=.4+i*.45;
        e.push(text(`factor-${i}-label`,label,x,y,F.size,{fit:step*.86,at,enter:'fade',dur:.2}),
          text(`factor-${i}-value`,value,x,y+F.size*1.5,F.size*1.2,{font:'figures',fit:step*.84,at,enter:'fade',dur:.2}));
        if(i%cols<cols-1)e.push(text(`times-${i}`,'×',x+step*.9,y+F.size*1.5,F.size,{at,enter:'fade',dur:.2}));
      });
      e.push(text('all-factors','Pay × years × accrual × adjustment',F.left,F.h*.56,F.size,{fit:F.width,at:2.3,enter:'fade',dur:.2}),
        text('annual',`${money(benefit.annual)} / year`,F.left,F.h*.65,F.size*1.65,{font:'figures',fit:F.width,at:2.6,enter:'fade',dur:.25}),
        text('monthly',`Monthly ≈ ${money(benefit.monthly)} (annual ÷ 12)`,F.left,F.h*.74,F.size,{fit:F.width,at:2.6,enter:'fade',dur:.25}));
      beats.push(canvasBeat(name(c,'formula'),c.title,e,source,F,10));
      break;
    }
    case 'R07': {
      ensure(Array.isArray(p.quotes)&&p.quotes.length===3,'three explicitly supplied quotes required');
      const e=[],top=F.h*(F.tall?.25:.30),step=F.h*(F.tall?.20:.16);
      p.quotes.forEach((q,i)=>{
        ensure(Number.isFinite(q.amount)&&q.amount>=0,'quoted amount must be nonnegative');
        ensure(['one-time','per month'].includes(q.basis),'quote basis must be explicit');
        ensure(q.label.length<=25&&q.conditions.length<=95,'quote copy is too long');
        const y=top+i*step;
        e.push(line(`quote-${i}-rule`,F.left,y-F.size*.8,F.right,y-F.size*.8,{stroke:'line'}));
        if(F.tall){
          e.push(text(`quote-${i}-name`,q.label,F.left,y,F.size,{font:'semibold',fit:F.width}),
            text(`quote-${i}-amount`,money(q.amount),F.left,y+F.size*1.6,F.size*1.5,{font:'figures',fit:F.width*.54}),
            text(`quote-${i}-basis`,q.basis,F.left+F.width*.57,y+F.size*1.6,F.size,{fit:F.width*.42}),
            text(`quote-${i}-conditions`,q.conditions,F.left,y+F.size*3.1,F.size,{width:F.width,height:step-F.size*3.3}));
        }else{
          e.push(text(`quote-${i}-name`,q.label,F.left,y,F.size,{width:F.width*.20,height:step*.8,font:'semibold'}),
            text(`quote-${i}-amount`,money(q.amount),F.left+F.width*.23,y,F.size*1.3,{font:'figures',fit:F.width*.21}),
            text(`quote-${i}-basis`,q.basis,F.left+F.width*.23,y+F.size*1.3,F.size*.9,{fit:F.width*.21}),
            text(`quote-${i}-conditions`,q.conditions,F.left+F.width*.49,y,F.size,{width:F.width*.51,height:step*.85}));
        }
      });
      audit={quotes:p.quotes,comparison:'No present-value or lifetime-total equivalence is asserted.'};
      beats.push(canvasBeat(name(c,'quotes'),c.title,e,source,F,13));
      break;
    }
    case 'R08': {
      ensure(p.amounts.length===p.priceIndices.length&&p.amounts.length>=2,'matching amount and index arrays required');
      const real=p.amounts.map((v,i)=>purchasingPower(v,p.priceIndices[i],p.baseIndex));
      audit={nominal:p.amounts,priceIndices:p.priceIndices,baseIndex:p.baseIndex,basePeriod:p.basePeriod,real};
      beats.push(moneyPlot(c,F,c.title,[{id:'nominal',label:'Nominal payment',values:p.amounts.map((y,x)=>({x,y}))},
        {id:'real',label:`${p.basePeriod} purchasing power`,values:real.map((y,x)=>({x,y}))}],p.periodUnit));
      const last=p.amounts.length-1, index=p.priceIndices[last];
      const e=[text('base',`Price index: ${p.basePeriod} = ${p.baseIndex}; year ${last} = ${index}`,F.left,F.h*.32,F.size,{fit:F.width}),
        text('rule','Real payment = nominal × base index ÷ current index',F.left,F.h*.43,F.size,{width:F.width,height:F.size*3,at:.5,enter:'fade',dur:.25}),
        text('substitution',`${money(p.amounts[last])} × ${p.baseIndex} ÷ ${index}`,F.left,F.h*.59,F.size*1.45,{font:'figures',fit:F.width,at:1.5,enter:'fade',dur:.25}),
        text('result',`≈ ${money(real[last])} / month in ${p.basePeriod} dollars`,F.left,F.h*.72,F.size*1.15,{font:'figures',fit:F.width,at:2.5,enter:'fade',dur:.25})];
      beats.push(canvasBeat(name(c,'deflate'),`Year ${last}: convert to ${p.basePeriod} purchasing power`,e,source,F,10));
      break;
    }
    case 'R09': {
      ensure(signature(p.orderA)===signature(p.orderB),'the two paths must use exactly the same return multiset');
      ensure(p.orderA.length===p.withdrawals.length,'one withdrawal per period required');
      const run=returns=>accountLedger({openingBalance:p.openingBalance,cashflowTiming:p.cashflowTiming,
        periods:returns.map((returnRate,i)=>({label:`Year ${i+1}`,returnRate,withdrawal:p.withdrawals[i]}))});
      const a=run(p.orderA),b=run(p.orderB);audit={a,b,returnsA:p.orderA,returnsB:p.orderB};
      const e=[],cell=F.width/p.orderA.length;
      for(const [row,returns] of [p.orderA,p.orderB].entries()){
        const y=F.h*(.34+row*.20);
        e.push(text(`order-${row}-name`,row?'Order B':'Order A',F.left,y-F.size*1.6,F.size,{font:'semibold'}));
        returns.forEach((r,i)=>{
          const x=F.left+cell*i;
          e.push(text(`order-${row}-${i}-year`,`${i+1}`,x,y-F.size*.25,F.size*.85,{fill:'muted'}),
            text(`order-${row}-${i}-return`,percent(r),x,y+F.size,F.size*1.15,{font:'figures',fill:r<0?'negative':'positive',fit:cell*.85}));
        });
      }
      const total=p.withdrawals.reduce((s,v)=>s+v,0);
      e.push(text('requests',`${money(total)} requested in each path`,F.left,F.h*.73,F.size,{width:F.width,height:F.size*2.1}));
      beats.push(canvasBeat(name(c,'orders'),'Same returns, different order',e,source,F));
      beats.push(moneyPlot(c,F,c.title,[{id:'a',label:'Order A balance',values:trace(a)},{id:'b',label:'Order B balance',values:trace(b)}],'Years',p.capacity));
      if(a.totals.shortfall>0 || b.totals.shortfall>0) {
        add(stackedRows([{label:'Order A',summary:`${money(a.totals.shortfall)} unfunded`,parts:[{value:a.totals.withdrawn,color:'accent'},{value:a.totals.shortfall,color:'accent2'}]},
          {label:'Order B',summary:`${money(b.totals.shortfall)} unfunded`,parts:[{value:b.totals.withdrawn,color:'accent'},{value:b.totals.shortfall,color:'accent2'}]}],
          {domain:total,title:'The same requests, different shortfalls',id:name(c,'shortfalls'),source:`Illustrative USD, rounded. Blue: paid; orange: unfunded requests. · ${c.asOf}`},F));
      }
      break;
    }
    default: throw Error(`Unknown retirement recipe ${c.recipe}`);
  }
  return {caseId:c.id,recipe:c.recipe,preset,beats,audit,geometry};
}
