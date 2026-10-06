import {phaseTrail} from './phase-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`phase scene: ${m}`);};
const show={at:0,enter:'none'};
const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra});
const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,...show,...extra});
export function phaseValue(value,decimals){if(value===null)return 'missing';const s=value.toFixed(decimals).replace(/^-0(?=\.0+$|$)/,'0');return (Number(s)===value?'':'≈')+s;}
// Segment/rectangle intersection, including endpoint contact. Used only to
// reserve quadrant copy; never to alter, smooth or clip an observation.
function crosses(a,b,box){
 const [l,t,r,d]=box;let lo=0,hi=1;
 for(const [p,q] of [[-(b[0]-a[0]),a[0]-l],[b[0]-a[0],r-a[0]],[-(b[1]-a[1]),a[1]-t],[b[1]-a[1],d-a[1]]]){
  if(p===0){if(q<0)return false;continue;}const v=q/p;if(p<0)lo=Math.max(lo,v);else hi=Math.min(hi,v);if(lo>hi)return false;
 }
 return true;
}
export function phaseScene(input,{width:w,height:h,id,view='trail',reveal=false}){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=640&&h>=640&&w<=4096&&h<=4096,'frame dimensions must be 640–4096');
 check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(['trail','focus'].includes(view),'view must be trail or focus');check(typeof reveal==='boolean','reveal must be boolean');
 const m=phaseTrail(input);check(m.points.length<=24,'at most 24 dated rows per picture; select and declare a shorter window');
 const tall=h>w,margin=w*(tall?.105:.07),font=w*(tall?.031:.022),small=w*(tall?.028:.02),left=w*(tall?.20:.41),right=w*(tall?.89:.93),top=h*(tall?.30:.235),bottom=h*(tall?.665:.72),r=w*.006,px=v=>left+(v-m.x.domain[0])/(m.x.domain[1]-m.x.domain[0])*(right-left),py=v=>bottom-(v-m.y.domain[0])/(m.y.domain[1]-m.y.domain[0])*(bottom-top),rx=px(m.x.reference),ry=py(m.y.reference),sourceId=id+'-source',elements=[],geometry={box:[left,top,right,bottom],reference:[rx,ry],points:[],segments:[],labels:[],timeline:[]},points=m.points.map(p=>({...p,point:p.valid?[px(p.x),py(p.y)]:null,at:reveal&&view==='trail'?1+12*p.time:0}));
 const copyWidth=tall?w-2*margin:left-margin-small*2.8;
 const yLabelWidth=tall?left-margin-small*.6:small*2.1;
 elements.push(text(id+'-title',m.title,margin,h*(tall?.12:.115),w*(tall?.047:.032),{font:'display',width:w-2*margin,height:h*.075}),text(id+'-dates',`${m.dateSpan[0]} to ${m.dateSpan[1]}`,margin,h*(tall?.19:.265),font,{font:'figures',...(tall?{fit:copyWidth}:{width:copyWidth,height:h*.12})}),text(id+'-references',`References: x = ${phaseValue(m.x.reference,m.x.decimals)} · y = ${phaseValue(m.y.reference,m.y.decimals)}`,margin,h*(tall?.235:.43),small,{font:'figures',...(tall?{fit:copyWidth}:{width:copyWidth,height:h*.11})}));
 check(m.x.ticks.every((v,i)=>!i||px(v)-px(m.x.ticks[i-1])>=small*1.8),'x ticks too close');check(m.y.ticks.every((v,i)=>!i||py(m.y.ticks[i-1])-py(v)>=small*1.7),'y ticks too close');
 const tickBoxes=m.x.ticks.map((v,i)=>{const length=phaseValue(v,m.x.decimals).length*small*.7,start=px(v)-(i===0?0:i===m.x.ticks.length-1?length:length/2);return[start,start+length];});
 check(tickBoxes.every((b,i)=>b[0]>=left-1e-7&&b[1]<=right+1e-7&&(!i||b[0]-tickBoxes[i-1][1]>=small*.35)),'x tick labels overlap; use fewer ticks or a shorter honest notation');
 check(m.y.ticks.every(v=>phaseValue(v,m.y.decimals).length*28*.7<=yLabelWidth),'y tick labels cannot retain 28 px in the reserved margin');
 for(const [i,v]of m.x.ticks.entries())elements.push(line(`${id}-x-grid-${i}`,px(v),top,px(v),bottom,{stroke:v===m.x.reference?'muted':'line',width:v===m.x.reference?2:1}),text(`${id}-x-tick-${i}`,phaseValue(v,m.x.decimals),px(v),bottom+small*1.25,small,{anchor:i===0?'start':i===m.x.ticks.length-1?'end':'middle',font:'figures'}));
 for(const [i,v]of m.y.ticks.entries())elements.push(line(`${id}-y-grid-${i}`,left,py(v),right,py(v),{stroke:v===m.y.reference?'muted':'line',width:v===m.y.reference?2:1}),text(`${id}-y-tick-${i}`,phaseValue(v,m.y.decimals),left-small*.4,py(v)+small*.3,small,{anchor:'end',font:'figures',fit:yLabelWidth}));
 elements.push(text(id+'-y-name',m.y.label,tall?margin:left,top-small*.65,small,{fit:tall?w-2*margin:right-left}),text(id+'-x-name',m.x.label,right,bottom+small*2.65,small,{anchor:'end',fit:right-left}));
 const paths=m.segments.map(s=>[points[s.from].point,points[s.to].point]);
 for(const [q,box]of Object.entries({NW:[left,top,rx,ry],NE:[rx,top,right,ry],SW:[left,ry,rx,bottom],SE:[rx,ry,right,bottom]})){
  const rows=m.quadrants[q].split('/').map(s=>s.trim());check(rows.length<=2&&rows.every(Boolean),'quadrant labels need one line or two slash-separated lines');
  const size=Math.max(28,small*.84),bw=Math.max(...rows.map(s=>s.length))*size*.62+12,bh=rows.length*size*1.2+8,pad=small*.25,[l,t,rr,bb]=box;
  check(bw+2*pad<rr-l&&bh+2*pad<bb-t,'quadrant copy does not fit; shorten labels or move references away from the edge');
  const candidates=[t+pad,bb-pad-bh,(t+bb-bh)/2].flatMap(y=>[l+pad,rr-pad-bw,(l+rr-bw)/2].map(x=>[x,y])),clearance=r*1.6+4;
  const placed=candidates.find(([x,y])=>{const b=[x-clearance,y-clearance,x+bw+clearance,y+bh+clearance];return points.filter(p=>p.valid).every(p=>!crosses(p.point,p.point,b))&&paths.every(([a,c])=>!crosses(a,c,b));});
  check(placed,`no clear copy zone in ${q}; shorten quadrant labels or use a different declared window`);
  const [x,y]=placed;rows.forEach((s,i)=>elements.push(text(`${id}-quadrant-${q}-${i}`,s,x,y+size*(.95+i*1.2),size,{fill:'muted'})));geometry.labels.push({quadrant:q,box:[x,y,bw,bh],rows});
 }
 for(const s of m.segments){const a=points[s.from],b=points[s.to];elements.push(line(`${id}-segment-${s.to}`,...a.point,...b.point,{stroke:view==='focus'?'muted':'accent',width:w*.0025,...(reveal&&view==='trail'?{at:a.at,enter:'draw',dur:b.at-a.at,drawEase:'linear'}:{})}));geometry.segments.push({...s,p1:a.point,p2:b.point,at:a.at,end:b.at});}
 // All observed markers paint over the connecting guides. No marker travels
 // through unobserved intermediate states, and null has no invented location.
 for(const p of points){
  geometry.points.push(p);
  if(p.valid)elements.push({id:`${id}-point-${p.index}`,type:'circle',cx:p.point[0],cy:p.point[1],r,fill:view==='focus'&&p.date!==m.focus.date?'muted':'accent',stroke:'bg',width:2,...show,at:p.at});
 }
 const focus=points[m.focus.index];
 if(view==='focus'&&focus.valid)elements.push({id:id+'-selected',type:'circle',cx:focus.point[0],cy:focus.point[1],r:r*1.65,fill:'none',stroke:'ink',width:3,...show});
 const readoutY=h*(tall?.735:.59),readoutX=tall?left:margin,readoutWidth=tall?right-left:copyWidth;
 if(view==='trail')for(const [i,p]of points.entries()){
  const timing={at:p.at,...(reveal&&i<points.length-1?{exit:'none',exitAt:points[i+1].at}:!reveal&&i<points.length-1?{exit:'none',exitAt:0}:{})};
  elements.push(text(`${id}-current-${i}`,`${p.valid?'Observation':'Missing pair'}: ${p.date}`,readoutX,readoutY,small,{font:'figures',fit:readoutWidth,...timing}));
  if(p.valid)elements.push({id:`${id}-current-ring-${i}`,type:'circle',cx:p.point[0],cy:p.point[1],r:r*1.65,fill:'none',stroke:'ink',width:3,...show,...timing});
 }
 else elements.push(text(id+'-selection-caption','Outlined marks identify the selected date',readoutX,readoutY,small,{...(tall?{fit:readoutWidth}:{width:readoutWidth,height:h*.10})}));
 const ty=h*(tall?.765:.86),tl=left,tr=right,datesize=Math.max(28,small*.80);
 check(points.every((p,i)=>!i||(p.time-points[i-1].time)*(tr-tl)>=r*1.8+3),'dated strip marks overlap; use a shorter declared window');
 elements.push(line(id+'-time-axis',tl,ty,tr,ty));
 if(tall)elements.push(text(id+'-time-start',m.dateSpan[0],tl,ty+small*1.15,datesize,{font:'figures'}),text(id+'-time-end',m.dateSpan[1],tr,ty+small*1.15,datesize,{anchor:'end',font:'figures'}));
 else elements.push(text(id+'-time-label','Dates →',left,ty+small*.9,datesize,{fit:small*4}));
 for(const p of points){const x=tl+p.time*(tr-tl),selected=view==='focus'&&p.date===m.focus.date;elements.push({id:`${id}-time-${p.index}`,type:'circle',cx:x,cy:ty,r:r*.7,fill:p.valid?'accent':'bg',stroke:selected?'ink':'muted',width:selected?3:2,...show,at:p.at});geometry.timeline.push({index:p.index,point:[x,ty],valid:p.valid,selected,at:p.at});}
 const fy=h*(tall?.865:.835),selectedText=`${focus.date}: x ${phaseValue(focus.x,m.x.decimals)}, y ${phaseValue(focus.y,m.y.decimals)}`,state=focus.valid?(focus.quadrant?m.quadrants[focus.quadrant]:focus.boundary==='both-references'?'On both references':focus.boundary==='x-reference'?'On the x reference':'On the y reference'):'Incomplete pair; no plotted point',copyBox=tall?{fit:copyWidth}:{width:copyWidth,height:h*.11};
 if(view==='focus')elements.push(text(id+'-focus-values',selectedText,margin,h*(tall?.825:.72),small,{font:'figures',...copyBox}),text(id+'-focus-state',state,margin,fy,small,{...copyBox}));
 else elements.push(text(id+'-guide','Dated observations; lines are guides only',margin,h*(tall?.825:.72),small,{...copyBox}),text(id+'-missing',`${m.observed} pairs · ${m.missing} missing · no smoothing or assumed cycle`,margin,fy,small,{...copyBox}));
 elements.push(text(sourceId,`${m.source} · as of ${m.asOf}`,margin,h*(tall?.925:.935),Math.max(28,small),{width:w-2*margin,height:h*.045}));
 return {model:m,geometry,props:{view:[0,0,w,h],sourceElement:sourceId,elements}};
}
