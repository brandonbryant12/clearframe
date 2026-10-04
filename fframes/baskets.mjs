import {fixedBasket,basketAmount} from './basket-data.mjs';
const check=(ok,message)=>{if(!ok)throw Error(`basket scene: ${message}`);};
const show={at:0,enter:'none'};
const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,font:'text',fill:'ink',...show,...extra});
const rect=(id,x,y,w,h,extra={})=>({id,type:'rect',x,y,w,h,r:0,fill:'accent',...show,...extra});
const colors=['#3F708D','#B97A32','#817399','#51786B'];
export function basketScene(input,{width:w,height:h,id,view='prices'}={}){
 check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(['prices','budget'].includes(view),'view must be prices or budget');
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=960&&h>=960&&w<=4096&&h<=4096,'frame dimensions must be 960–4096');
 const model=fixedBasket(input),tall=h>w,n=model.items.length;check(n>=2&&n<=4&&model.periods.length===2,'native scene supports 2–4 items and exactly two snapshots');
 const margin=w*.10,span=w*.80,font=w*(tall?.038:.027),small=w*(tall?.0315:.0225),sourceSize=Math.max(28,small),elements=[],geometry={width:w,height:h,view,rectangles:[],tokens:[]};
 const sourceId=id+'-source',money=v=>basketAmount(v,model.currency),bare=v=>money(v).slice(0,-model.currency.unit.length-1);
 const common=(prefix,p,i)=>({at:i?6:1,enter:'fade',dur:.45});
 elements.push(text(id+'-title',model.title,margin,h*(tall?.105:.115),w*(tall?.052:.034),{font:'display',width:span,height:h*.055}),text(id+'-principle',view==='prices'?'Keep every quantity fixed. Reprice the same basket.':`Budget stays ${money(model.budgetMinor)} at both dates.`,margin,h*(tall?.175:.18),w*(tall?.038:.024),{width:span,height:h*.05}));
 if(view==='prices'){
  elements.push(text(id+'-basis',`${model.currency.unit} · ${model.priceBasis}`,margin,h*(tall?.235:.23),w*(tall?.029:.019),{width:span,height:h*.05}));
  const xs=tall?[w*.515,w*.775]:[w*.49,w*.79],rowStart=h*(tall?.35:.36),rowStride=h*(tall?(n===4?.065:.085):(n===4?.067:.085)),rowFont=w*(tall?.036:.024);
  elements.push(text(id+'-fixed','FIXED BASKET',margin,h*.285,small,{font:'bold'}));
  model.periods.forEach((p,j)=>elements.push(text(`${id}-date-${j}`,p.date,xs[j],h*.285,small,{anchor:'middle',font:'figures'}),text(`${id}-column-${j}`,'unit → cost',xs[j],h*.318,small*.9,{anchor:'middle'})));
  for(const [i,item]of model.items.entries()){
   const y=rowStart+i*rowStride;elements.push(rect(`${id}-key-${i}`,margin,y-rowFont*.76,rowFont*.18,rowFont*.80,{fill:colors[i]}),text(`${id}-item-${i}`,!tall&&n===4?`${item.label} · ${item.quantity} × ${item.unit}`:item.label,margin+rowFont*.4,y,rowFont,{fit:w*(tall?.29:.29),height:rowStride*.56}),text(`${id}-quantity-${i}`,!tall&&n===4?'':`${item.quantity} × ${item.unit}`,margin+rowFont*.4,y+rowFont*(tall?1.25:.95),small,{fit:w*(tall?.29:.25)}));
   model.periods.forEach((p,j)=>{const row=p.rows[i],label=row.unitPriceMinor===null?'missing':`${bare(row.unitPriceMinor)} → ${bare(row.lineCostMinor)}`;elements.push(text(`${id}-prices-${j}-${i}`,label,xs[j],y+rowFont*.45,rowFont,{anchor:'middle',font:'figures',fit:w*.25,...common(id,p,j)}));});
  }
  const max=Math.max(...model.periods.filter(p=>p.complete).map(p=>p.costMinor)),unit=10**model.currency.decimals,step=10**Math.floor(Math.log10(max)),domain=Math.ceil(max/step)*step,left=margin,right=w*.86,width=right-left,barHeight=h*(tall?.020:.027),ys=tall?[h*.62,h*.715]:[h*.65,h*.755];
  geometry.domainMinor=[0,domain];geometry.axis={left,right};
  model.periods.forEach((p,j)=>{
   const y=ys[j],timing=common(id,p,j);
   elements.push(text(`${id}-total-${j}`,`${p.date} · ${p.complete?money(p.costMinor):'INCOMPLETE — no basket total'}`,left,y-barHeight*.65,small,{font:'figures',fit:span,...timing}));
   if(!p.complete)return;
   let accumulated=0;
   p.rows.forEach((row,i)=>{const x=left+width*accumulated/domain,len=width*row.lineCostMinor/domain;if(len>0)elements.push(rect(`${id}-cost-${j}-${i}`,x,y,len,barHeight,{fill:colors[i],...timing}));geometry.rectangles.push({id:`${id}-cost-${j}-${i}`,date:p.date,item:row.id,x,y,w:len,h:barHeight,valueMinor:row.lineCostMinor,denominator:domain,scaleWidth:width,at:timing.at,fullAt:timing.at+timing.dur});accumulated+=row.lineCostMinor;});
  });
  const axisTop=ys[0]-barHeight*.4,axisBottom=ys[1]+barHeight;
  for(const [i,value]of [0,domain/2,domain].entries()){
   // Tick labels may use fractional minor units, so divide in major units here.
   const x=left+width*value/domain;elements.unshift({id:`${id}-grid-${i}`,type:'line',x1:x,y1:axisTop,x2:x,y2:axisBottom,stroke:'line',width:i?1:2,...show});
   elements.push(text(`${id}-tick-${i}`,`${value/unit} ${i===2?model.currency.unit:''}`.trim(),x,axisBottom+small*1.3,small,{anchor:i===0?'start':i===2?'end':'middle',font:'figures'}));
  }
  elements.push(text(id+'-qualification',model.qualification,margin,h*(tall?.79:.87),small,{width:span,height:h*.035}));
 }else{
  elements.push(text(id+'-meaning','1 outlined tile = 1 complete basket. No partial baskets.',margin,h*(tall?.23:.235),small,{width:span,height:h*.04}));
  const maxCount=Math.max(...model.periods.filter(p=>p.complete).map(p=>p.wholeBaskets));check(maxCount<=12,'budget scene supports at most 12 whole baskets per date');
  const cards=model.periods.map((p,i)=>({x:tall?margin:margin+i*w*.435,y:tall?h*(.27+i*.27):h*.30,w:tall?span:w*.365,h:tall?h*.23:h*.45}));
  model.periods.forEach((p,j)=>{
   const c=cards[j],timing=common(id,p,j);elements.push(rect(`${id}-card-${j}`,c.x,c.y,c.w,c.h,{fill:'none',stroke:'line',width:2}),text(`${id}-date-${j}`,p.date,c.x+small*.5,c.y+font*1.2,font,{font:'figures'}));
   if(!p.complete){elements.push(text(`${id}-missing-${j}`,'Prices incomplete.\nNo purchase count.',c.x+small*.5,c.y+font*3,font,{width:c.w-small,height:font*3,...timing}));return;}
   const size=Math.min(c.w/7.4,h*(tall?.029:.061)),gap=size*.18,top=c.y+font*1.8,start=c.x+small*.5;
   for(let i=0;i<p.wholeBaskets;i++){
    const x=start+(i%6)*(size+gap),y=top+Math.floor(i/6)*(size+gap);elements.push(rect(`${id}-basket-${j}-${i}`,x,y,size,size,{fill:'none',stroke:'accent',width:3,...timing}),{id:`${id}-handle-${j}-${i}`,type:'line',x1:x+size*.22,y1:y+size*.27,x2:x+size*.78,y2:y+size*.27,stroke:'accent',width:2,...show,...timing});geometry.tokens.push({date:p.date,index:i,x,y,w:size,h:size,at:timing.at,fullAt:timing.at+timing.dur});
   }
   const amountY=c.y+c.h*(tall?.54:.59),barY=c.y+c.h*(tall?.65:.71),barH=h*(tall?.015:.024),barX=start,barW=c.w-small;
   elements.push(text(`${id}-purchase-${j}`,`${p.wholeBaskets} baskets × ${money(p.costMinor)}`,start,amountY,small,{font:'figures',fit:c.w-small,...timing}));
   for(const [k,value,fill]of [['spent',p.spentMinor,'accent'],['left',p.remainderMinor,'#D9D1C4']]){
    const x=barX+(k==='left'&&model.budgetMinor>0?barW*p.spentMinor/model.budgetMinor:0),len=model.budgetMinor?barW*value/model.budgetMinor:0;
    if(len>0)elements.push(rect(`${id}-${k}-${j}`,x,barY,len,barH,{fill,...timing}));geometry.rectangles.push({id:`${id}-${k}-${j}`,date:p.date,x,y:barY,w:len,h:barH,valueMinor:value,denominator:model.budgetMinor,scaleWidth:barW,at:timing.at,fullAt:timing.at+timing.dur});
   }
   elements.push(text(`${id}-spent-label-${j}`,`Bought: ${money(p.spentMinor)}`,start,c.y+c.h*(tall?.82:.86),small,{font:'figures',fit:c.w-small,...timing}),text(`${id}-remainder-${j}`,`Left: ${money(p.remainderMinor)}`,start,c.y+c.h*(tall?.94:.965),small,{font:'figures',fit:c.w-small,...timing}));
  });
  elements.push(text(id+'-no-substitution',tall?'Same composition · no substitution\nCash remainder retained':'Same composition · no substitution · cash remainder retained',margin,tall?h*.81:h*.79,small,{width:span,height:h*.04}));
  // Text labels identify both money components, including a zero-width remainder.
  geometry.cards=cards;geometry.maximumWholeBaskets=maxCount;
 }
 const sourceY=h*(tall?.86:.93);
 elements.push(text(sourceId,tall?`${model.source}\nAs of ${model.asOf}`:`${model.source} · as of ${model.asOf}`,margin,sourceY,sourceSize,{width:span,height:h*(tall?.06:.05)}));
 const duration=view==='prices'?38:26;
 return {model,geometry,duration,props:{view:[0,0,w,h],sourceElement:sourceId,elements:elements.filter(e=>e.type!=='text'||e.text!=='')},clock:{beforeAt:1,afterAt:6,fadeSeconds:.45,settledAt:6.45,finalHold:duration-6.45}};
}
