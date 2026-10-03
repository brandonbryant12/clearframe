import {distribution} from './distribution-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`distribution scene: ${m}`);};
const show={at:0,enter:'none'},text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra}),line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,...show,...extra});
export const thresholdLabel=t=>`${{gte:'≥',gt:'>',lte:'≤',lt:'<'}[t.relation]} ${t.value}`;
export function distributionScene(input,{width:w,height:h,id,focus=false,reveal=false}){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=640&&h>=640&&w<=4096&&h<=4096,'frame dimensions must be 640–4096');check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(typeof focus==='boolean'&&typeof reveal==='boolean','focus and reveal must be booleans');
 const model=distribution(input),m=model,tall=h>w,margin=w*(tall?.105:.07),size=w*(tall?.032:.024),left=w*.19,right=w*.89,top=h*(tall?.31:.32),bottom=h*(tall?.59:.62),stripTop=h*(tall?.70:.74),stripBottom=h*(tall?.79:.83),r=w*.0055,pitch=3*r+3,px=v=>left+(v-m.edges[0])/(m.edges.at(-1)-m.edges[0])*(right-left),py=v=>bottom-v/m.y.max*(bottom-top),elements=[],labels=[],geometry={bars:[],points:[],threshold:null},sourceId=id+'-source';
 elements.push(text(id+'-title',m.title,margin,h*(tall?.09:.115),w*(tall?.047:.034),{font:'display',width:w-2*margin,height:h*.08}),text(id+'-summary',focus?`${m.threshold.count} of ${m.n} observed ${thresholdLabel(m.threshold)} ${m.unit}`:`${m.n} observed · ${m.missing} missing · explicit bins`,margin,h*(tall?.165:.205),w*(tall?.035:.028),{font:'figures',fit:w-2*margin}),text(id+'-measure',m.mode==='count'?'Bin height = count':`Area = share · density per ${m.unit}`,margin,h*(tall?.24:.275),size,{fit:w-2*margin}));
 for(const [i,v]of m.y.ticks.entries())elements.push(line(`${id}-grid-${i}`,left,py(v),right,py(v),{stroke:v===0?'muted':'line',width:v===0?2:1}),text(`${id}-y-${i}`,v.toFixed(m.y.decimals),left-size*.4,py(v)+size*.3,size,{anchor:'end',font:'figures',fit:left-margin-size*.6}));
 for(const b of m.bins){const x=px(b.low),y=py(b.height),bw=px(b.high)-x,bh=bottom-y,at=reveal?.4+b.index*.16:0,dur=reveal?.8:0;
  check(bw>=12,'bins too narrow for this frame');check(!b.count||bh>=1,'positive bars must occupy at least one native pixel; choose a tighter y maximum');
  if(b.count)elements.push({id:`${id}-bar-${b.index}`,type:'rect',x,y,w:bw,h:bh,fill:'accent',stroke:'bg',width:1,...show,...(reveal?{origin:[x,bottom],keys:[{at:0,scaleY:0,dur:0},{at,scaleY:1,dur,ease:'linear'}]}:{})});
  const labelY=(b.count?y:bottom)-size*.35,labelWidth=Math.min(bw*.92,size*.85*(`n=${b.count}`.length*.65+.4));
  labels.push({id:`${id}-count-bg-${b.index}`,type:'rect',x:x+bw/2-labelWidth/2,y:labelY-size*.85,w:labelWidth,h:size*1.05,fill:'bg',...show,at:at+dur},text(`${id}-count-${b.index}`,`n=${b.count}`,x+bw/2,labelY,size*.85,{anchor:'middle',font:'figures',fit:bw*.92,at:at+dur}));
  geometry.bars.push({...b,box:[x,y,bw,bh],at,end:at+dur});
 }
 for(const [i,v]of m.edges.entries())elements.push(text(`${id}-x-${i}`,v,px(v),bottom+size*1.3,size*.9,{anchor:i===0?'start':i===m.edges.length-1?'end':'middle',font:'figures',fit:(right-left)/(m.edges.length-1)*.85}));
 elements.push(text(id+'-x-unit',m.unit,right,bottom+size*2.5,size*.9,{anchor:'end'}),text(id+'-strip-label',focus?'Outlined dots meet the threshold':'Each dot is one observed value',margin,stripTop-size*.7,size*.9,{fit:w-2*margin}));
 // Deterministic collision packing preserves x exactly. Y is only separation,
 // not a second quantity. Reject cramped frames instead of silently overlapping.
 if(focus){const x=px(m.threshold.value);geometry.threshold={x,segments:[[top,bottom],[stripTop-r*1.5,stripBottom]],at:.2,end:1};for(const [i,[y1,y2]]of geometry.threshold.segments.entries())elements.push(line(`${id}-threshold-${i}`,x,y1,x,y2,{stroke:'ink',width:2,at:.2,enter:'draw',dur:.8,drawEase:'linear'}));}
 elements.push(...labels);
 const rows=[];
 for(const o of [...m.observations].filter(o=>o.value!==null).sort((a,b)=>a.value-b.value||a.index-b.index)){
  const x=px(o.value);let row=rows.findIndex(last=>x-last>=pitch);if(row<0){row=rows.length;rows.push(-Infinity);}rows[row]=x;const y=stripTop+row*pitch;check(y+r*1.3+1.5<=stripBottom,'sample strip too dense; fewer observations or larger frame required');
  const selected=focus&&o.qualifies,at=focus?.45:0;
  elements.push({id:`${id}-sample-${o.index}`,type:'circle',cx:x,cy:y,r,fill:'accent',...show});
  if(selected)elements.push({id:`${id}-selected-${o.index}`,type:'circle',cx:x,cy:y,r:r*1.3,fill:'none',stroke:'ink',width:3,...show,at});
  geometry.points.push({...o,point:[x,y],r,selected,at});
 }

 elements.push(text(id+'-limit',focus?'Observed sample share · not a forecast':`Bins include left edge; last includes both · ${m.missing} missing`,margin,h*(tall?.855:.885),w*(tall?.029:.022),{fit:w-2*margin}),text(sourceId,`${m.source} ${m.asOf}.`,margin,h*(tall?.915:.935),w*(tall?.028:.023),{width:w-2*margin,height:h*.055}));
 return{model,geometry,props:{view:[0,0,w,h],sourceElement:sourceId,elements}};
}
