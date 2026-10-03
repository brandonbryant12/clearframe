import test from 'node:test';
import assert from 'node:assert/strict';
import {cases} from '../examples/library-kits/retirement/source/fixtures.mjs';
import {buildCase} from '../examples/library-kits/retirement/source/recipes.mjs';
const fixture=id=>cases.find(c=>c.id===id);
const near=(actual,expected)=>assert(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-10,`${actual} != ${expected}`);

test('retirement pictures retain independently computed match, ownership, formula and depletion facts',()=>{
  const single=buildCase(fixture('single-match')).audit.match;
  near(single.employerContribution,1800);
  const tiered=buildCase(fixture('tiered-match')).audit.match;
  assert.deepEqual(tiered.tiers.map(t=>[t.eligible,t.matched]),[[2400,2400],[1600,800]]);
  near(tiered.aboveMatchThreshold,2400);
  const graded=buildCase(fixture('graded-ownership')).audit.current;
  near(graded.totalOwned,26000);near(graded.employerUnvested,4000);
  const cliff=buildCase(fixture('cliff-ownership')).audit.current;
  near(cliff.totalOwned,12000);near(cliff.employerUnvested,6000);
  const benefit=buildCase(fixture('adjusted-benefit')).audit.benefit;
  near(benefit.annual,32400);near(benefit.monthly,2700);
  const depleted=buildCase(fixture('depleted-account')).audit.ledger;
  assert.deepEqual(depleted.rows.map(r=>r.closing),[18000,6000,0]);
  near(depleted.totals.withdrawn,30000);near(depleted.totals.shortfall,6000);
});

test('fee paths reconcile into the gap and price-adjusted values use the stated base',()=>{
  const c=buildCase(fixture('fees-on-reserve')).audit.comparison;
  near(c.baseline.closingBalance,100000*(1.05*.999)**8);
  near(c.comparison.closingBalance,100000*(1.05*.99)**8);
  near(c.endingBalanceDifference,c.chargedFeeDifference+c.gainDifference-c.fundedWithdrawalDifference);
  const real=buildCase(fixture('rising-prices')).audit.real;
  near(real[0],3000);near(real.at(-1),2400);
  const more=buildCase(fixture('falling-prices')).audit.real;
  near(more.at(-1),2500*100/94);
});

test('same-return comparisons preserve cashflow rules and expose funded-payment differences after depletion',()=>{
  const c=buildCase(fixture('return-order')).audit;
  near(c.a.closingBalance,32952);near(c.b.closingBalance,49046.25);
  const result=buildCase(fixture('return-order-depletion'));
  near(result.audit.a.closingBalance,0);near(result.audit.b.closingBalance,0);
  assert(result.audit.a.totals.shortfall>result.audit.b.totals.shortfall);
  assert(result.beats.some(b=>b.id.endsWith('shortfalls')));
  const bad=structuredClone(fixture('return-order'));bad.inputs.orderB[0]=.09;
  assert.throws(()=>buildCase(bad),/same return multiset/);
});

test('quantitative rectangular marks preserve data ratios, areas and common baselines in both layouts',()=>{
  for(const preset of ['landscape','vertical'])for(const c of cases){
    const result=buildCase(c,preset);
    for(const g of result.geometry){
      const b=result.beats.find(b=>b.id===g.beat);
      const mark=b.props.elements.find(e=>e.id===`${g.beat}-${g.id}`);
      if(g.kind==='stack'){
        if(g.value===0){assert.equal(mark,undefined);continue;}
        const track=b.props.elements.find(e=>e.id===`${g.beat}-${g.id.split('-part-')[0]}-track`);
        near(mark.w/track.w,g.value/g.domain);
        near(mark.w*mark.h/(track.w*track.h),g.value/g.domain);
        assert.equal(mark.y,track.y);
      }else if(g.kind==='reservoir'){
        if(g.value===0){assert.equal(mark,undefined);continue;}
        const tank=b.props.elements.find(e=>e.id===`${g.beat}-${g.id.replace('-fill','-outline')}`);
        near(mark.h/tank.h,g.value/g.capacity);
        near(mark.w*mark.h/(tank.w*tank.h),g.value/g.capacity);
        near(mark.y+mark.h,tank.y+tank.h);
      }else{
        if(g.to===g.from){assert.equal(mark,undefined);continue;}
        near(mark.h/g.span,Math.abs(g.to-g.from)/(g.domain[1]-g.domain[0]));
      }
      // Geometry never overshoots or passes through misleading intermediate amounts.
      assert.equal(mark.keys,undefined);assert(['none','fade'].includes(mark.enter));
    }
  }
});

test('quoted payout choices preserve supplied bases and never imply an actuarial equivalence',()=>{
  const c=fixture('fixed-quotes'),r=buildCase(c);
  assert.deepEqual(r.audit.quotes,c.inputs.quotes);
  assert(r.audit.comparison.includes('No present-value'));
  const labels=r.beats.flatMap(b=>b.props.elements).filter(e=>e.type==='text').map(e=>e.text).join(' ');
  assert(labels.includes('one-time'));assert(labels.includes('per month'));assert(labels.includes('lifetimes unknown'));
});
