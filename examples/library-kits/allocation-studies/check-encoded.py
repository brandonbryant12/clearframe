"""Independent integer allocation and encoded-token conservation checks.

No JavaScript imports. Every tray frame is decoded at 720 px with two FFmpeg
workers. NumPy performs color masks; run-length components count whole tiles.
Comparison frames are sampled at 2 Hz plus cut/final boundaries.
"""
import hashlib,json,math,subprocess
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text())
AUDIT=json.loads((ROOT/'audit.json').read_text())
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def amount(n,q):
 scale=10**q['decimals'];div=10**(q['decimals']-q['displayDecimals']);assert n%div==0
 return str(n//scale)+('.'+str(n%scale//div).zfill(q['displayDecimals']) if q['displayDecimals'] else '')+' '+q['unit']
def share(n,total):
 t=(n*1000*2+total)//(2*total)
 return ('' if t*total==n*1000 else '≈')+(str(t//10)+'.'+str(t%10) if t%10 else str(t//10))+'%'
def components(mask):
 """4-connected blue runs, with all areas/bounds retained before classification."""
 changes=np.diff(mask.astype(np.int8),axis=1,prepend=np.int8(0),append=np.int8(0))
 ys,xs=np.nonzero(changes==1);ye,xe=np.nonzero(changes==-1);assert np.array_equal(ys,ye)
 parents=[];runs=[];previous=[];current=[];row=-2
 def find(i):
  while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
  return i
 for y,x,end in zip(ys.tolist(),xs.tolist(),xe.tolist()):
  if y!=row:previous=current if y==row+1 else [];current=[];row=y
  i=len(parents);parents.append(i);runs.append((y,x,end));current.append((x,end,i))
  for a,b,j in previous:
   if x<b and a<end:parents[find(i)]=find(j)
 result={}
 for i,(y,x,end) in enumerate(runs):
  key=find(i)
  if key not in result:result[key]=[x,y,end,y+1,0]
  c=result[key];c[0]=min(c[0],x);c[1]=min(c[1],y);c[2]=max(c[2],end);c[3]=max(c[3],y+1);c[4]+=end-x
 return list(result.values())

assert AUDIT['inputSha256']==sha(ROOT/'inputs.json')
reports=[]
for audit in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==audit['caseId']);name=audit['name'];folder=ROOT/'evidence'/name;video=folder/'video.mp4';job=read(folder/'native-job.json');W,H=job['width'],job['height'];tall=H>W;w=720;h=round(w*H/W);q=w/W
 quantum=c['quantum'];buckets=c['buckets'];ids=[b['id'] for b in buckets];initial=[b['count'] for b in buckets];total=sum(initial);stacks={b['id']:[f"{b['id']}-{i+1:03d}" for i in range(b['count'])] for b in buckets};tokens={tid:{'initialBucket':b['id'],'initialSlot':i} for b in buckets for i,tid in enumerate(stacks[b['id']])};events=[];native=arithmetic=0
 def counts():return [len(stacks[b['id']]) for b in buckets]
 for group,g in enumerate(c['moves']):
  assert len(stacks[g['from']])>=g['count']
  for _ in range(g['count']):
   before=counts();from_slot=len(stacks[g['from']])-1;token=stacks[g['from']].pop();transit=counts();to_slot=len(stacks[g['to']]);stacks[g['to']].append(token);i=len(events)
   events.append({'index':i,'groupIndex':group,'token':token,'from':g['from'],'to':g['to'],'fromSlot':from_slot,'toSlot':to_slot,'before':before,'inTransit':transit,'after':counts(),'start':3+i*3,'end':3+i*3+2.4})
 for bid,stack in stacks.items():
  for i,tid in enumerate(stack):tokens[tid].update(finalBucket=bid,finalSlot=i)
 final=counts();capacities=[max([initial[i]]+[e['after'][i] for e in events]) for i in range(len(buckets))];duration=3+len(events)*3+7;cut=round(duration*30);frames_total=cut+720
 assert job['fps']==30 and job['frames']==frames_total and [b['frames'] for b in job['beats']]==[cut,720]
 for stage in audit['stages']:
  m=stage['model'];assert m['total']==total and m['totalMinorUnits']==total*quantum['minorUnits'];assert m['capacity']==capacities and m['grossTransfers']==len(events);arithmetic+=4
  assert len(m['tokens'])==total
  for actual in m['tokens']:
   assert {k:actual[k] for k in tokens[actual['id']]}==tokens[actual['id']];arithmetic+=4
  for key,values in [('before',initial),('after',final)]:
   for i,n in enumerate(values):
    a=m[key][i];assert a['count']==n and a['minorUnits']==n*quantum['minorUnits'];assert a['share']=={'numerator':n,'denominator':total} and a['shareLabel']==share(n,total);arithmetic+=4
  assert len(m['events'])==len(events)
  for actual,e in zip(m['events'],events):assert actual=={k:v for k,v in e.items() if k not in ['start','end']};arithmetic+=1
  near(stage['clock']['duration'],duration)
  for actual,e in zip(stage['clock']['events'],events):
   for k,v in e.items():near(actual[k],v) if k in ['start','end'] else None
  assert stage['duration']==(duration if stage['id']=='trays' else 24)

 # Independent layout equations and exact orthogonal paths. The token's amount
 # does not depend on its screen location or which route leg is being traversed.
 n=len(buckets);font=W*(.032 if tall else .021);small=W*(.030 if tall else .0185);size=W*(.042 if tall else .024);gap=size*.32;cards={}
 for i,b in enumerate(buckets):
  x=W*.115 if tall else W*.09+i*(W*.82/n+W*.035/n);y=H*.29+i*H*.48/n if tall else H*.30;width=W*.65 if tall else (W*.82-W*.035*(n-1))/n;height=H*.48/n-H*.045 if tall else H*.37
  cards[b['id']]={'x':x,'y':y,'width':width,'height':height,'gridX':x+(width-(6*size+5*gap))/2,'gridY':y+font*3.1,'corridorY':y+height+H*.0225-size/2 if tall else H*.725-size/2}
 def slot(bid,index):
  a=cards[bid];return [a['gridX']+(index%6)*(size+gap),a['gridY']+(index//6)*(size+gap)]
 starts={tid:slot(t['initialBucket'],t['initialSlot']) for tid,t in tokens.items()};keys={tid:[] for tid in tokens};routes=[]
 for e in events:
  a,b=slot(e['from'],e['fromSlot']),slot(e['to'],e['toSlot']);cy1=cards[e['from']]['corridorY'];cy2=cards[e['to']]['corridorY'];raw=[a,[a[0],cy1],[W*.865-size/2,cy1],[W*.865-size/2,cy2],[b[0],cy2],b] if tall else [a,[a[0],cy1],[b[0],cy2],b];points=[p for i,p in enumerate(raw) if i==0 or p!=raw[i-1]];lengths=[abs(b[0]-a[0])+abs(b[1]-a[1]) for a,b in zip(points,points[1:])];length=sum(lengths);elapsed=0;legs=[]
  for a,b,length_i in zip(points,points[1:],lengths):
   leg_duration=2.4*length_i/length;start=e['start']+elapsed;legs.append({'from':a,'to':b,'start':start,'end':start+leg_duration});keys[e['token']].append({'at':start,'dur':leg_duration,'ease':'linear','x':b[0]-starts[e['token']][0],'y':b[1]-starts[e['token']][1]});elapsed+=leg_duration
  routes.append({**e,'legs':legs,'points':points})
 def positions(time):
  result={tid:[*p] for tid,p in starts.items()}
  for e in routes:
   if time<e['start']:break
   if time>=e['end']:result[e['token']]=e['points'][-1];continue
   for leg in e['legs']:
    if time<leg['end']:
     f=max(0,min(1,(time-leg['start'])/(leg['end']-leg['start'])));result[e['token']]=[a+(b-a)*f for a,b in zip(leg['from'],leg['to'])];break
   break
  return result
 tray={e['id']:e for e in job['beats'][0]['props']['elements']};comparison={e['id']:e for e in job['beats'][1]['props']['elements']};actual_tokens=[e for e in tray.values() if e['id'].startswith('trays-token-')];assert len(actual_tokens)==total
 assert {e['id'] for e in tray.values() if e['type']=='rect' and e['fill']=='accent'}=={e['id'] for e in actual_tokens};native+=1
 for tid,p in starts.items():
  el=tray['trays-token-'+tid]
  for k,v in [('x',p[0]),('y',p[1]),('w',size),('h',size),('r',0),('at',0)]:near(el[k],v);native+=1
  assert el['enter']=='none' and el['fill']=='accent' and 'exit' not in el and 'opacity' not in el;native+=1
  assert len(el['keys'])==len(keys[tid])
  for actual,k in zip(el['keys'],keys[tid]):
   assert set(actual)==set(k) and actual['ease']=='linear'
   for field in ['at','dur','x','y']:near(actual[field],k[field]);native+=1
 states=[{'at':0,'counts':initial,'inTransit':0}]+[s for e in events for s in [{'at':e['start'],'counts':e['inTransit'],'inTransit':1},{'at':e['end'],'counts':e['after'],'inTransit':0}]]
 for i,s in enumerate(states):
  assert sum(s['counts'])+s['inTransit']==total;arithmetic+=1
  for j,b in enumerate(buckets):
   el=tray[f"trays-amount-{i}-{b['id']}"];assert el['text']==f"{s['counts'][j]} tiles · {amount(s['counts'][j]*quantum['minorUnits'],quantum)}";near(el['at'],s['at']);native+=2
   if i<len(states)-1:assert el['exit']=='none';near(el['exitAt'],states[i+1]['at']);native+=2
  el=tray[f'trays-conservation-{i}'];assert el['text']==f"{total-s['inTransit']} parked + {s['inTransit']} in transit = {total} tiles";near(el['at'],s['at']);native+=2
  if i<len(states)-1:assert el['exit']=='none';near(el['exitAt'],states[i+1]['at']);native+=2
 for ident,els in [('trays',tray),('comparison',comparison)]:
  assert els[ident+'-unit']['text']==f"1 tile = {amount(quantum['minorUnits'],quantum)} · total {amount(total*quantum['minorUnits'],quantum)}";assert els[ident+'-source']['text']==f"{c['source']} · as of {c['asOf']}";native+=2
 margin=W*(.105 if tall else .09);right=W*.82;bar_width=right-margin;bar_height=H*(.021 if tall else .032);bar_start=H*(.32 if tall else .33);stride=H*(.165 if tall else .18);bars=[]
 for i,b in enumerate(buckets):
  y=bar_start+i*stride;assert comparison[f'comparison-name-{i}']['text']==f"{b['label']} · {initial[i]} → {final[i]} tiles";assert comparison[f'comparison-share-{i}']['text']==share(final[i],total);native+=2
  for key,values,dy,color in [('before',initial,0,'muted'),('after',final,bar_height+8,'accent')]:
   count=values[i];ident=f'comparison-{key}-{i}';yy=y+font*.50+dy;ww=bar_width*count/total
   if not count:assert ident not in comparison;native+=1;continue
   e=comparison[ident]
   for k,v in [('x',margin),('y',yy),('w',ww),('h',bar_height)]:near(e[k],v);native+=1
   assert e['fill']==color and 'keys' not in e and e['enter']=='none';native+=1;bars.append({'x':margin,'y':yy,'width':ww,'height':bar_height,'color':color})
  for j,v in enumerate([0,total//2,total]):
   e=comparison[f'comparison-grid-{i}-{j}'];near(e['x1'],margin+bar_width*v/total);near(e['x2'],e['x1']);native+=2
 for j,v in enumerate([0,total//2,total]):assert comparison[f'comparison-tick-{j}']['text']==str(v)+(' tiles' if j==2 else '');native+=1

 frame_ids=list(range(cut))+sorted(set(range(cut,frames_total,15))|{cut+1,frames_total-1});expr=f'lt(n\\,{cut})+gte(n\\,{cut})*not(mod(n-{cut}\\,15))+eq(n\\,{cut+1})+eq(n\\,{frames_total-1})'
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 size_px=size*q;sampled=tray_frames=component_checks=position_checks=core_checks=bar_checks=outer_checks=0;max_noise=max_centroid_error=max_extent_error=0;min_component_area=math.inf;max_component_area=0;blue_counts=[]
 colors={k:np.array(list(bytes.fromhex(job['theme'][k][1:])),dtype=np.int16) for k in ['accent','muted']}
 try:
  for frame in frame_ids:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need);assert chunk,('short decode',name,frame);chunks.append(chunk);need-=len(chunk)
   arr=np.frombuffer(b''.join(chunks),dtype=np.uint8).reshape(h,w,3);sampled+=1
   if frame<cut:
    tray_frames+=1;ps={tid:[p[0]*q,p[1]*q] for tid,p in positions(frame/30).items()};a=arr.astype(np.int16);blue=(a[:,:,2]-a[:,:,0]>35)&(a[:,:,2]-a[:,:,1]>25);blue[:round(.28*h)]=False;blue[round(.80*h):]=False;all_components=components(blue);large=[c for c in all_components if c[4]>=.5*size_px**2]
    assert len(large)==total,(name,frame,'whole-token count',len(large),total,all_components);component_checks+=1;blue_counts.append(int(blue.sum()));unused=set(ps);allowed=np.zeros_like(blue)
    for tid,(x,y) in ps.items():
     allowed[max(0,math.floor(y)-2):min(h,math.ceil(y+size_px)+2),max(0,math.floor(x)-2):min(w,math.ceil(x+size_px)+2)]=True
     for fx,fy in [(.5,.5),(.35,.35),(.65,.35),(.35,.65),(.65,.65)]:
      actual=arr[round(y+fy*size_px),round(x+fx*size_px)].astype(np.int16);assert np.max(np.abs(actual-colors['accent']))<=24,(name,frame,'token core',tid,actual.tolist());core_checks+=1
    outside=int((blue&~allowed).sum());max_noise=max(max_noise,outside);assert outside<=4,(name,frame,'blue outside all token bounds',outside);outer_checks+=1
    for bx,by,ex,ey,area in large:
     center=((bx+ex)/2,(by+ey)/2);tid=min(unused,key=lambda k:math.dist(center,(ps[k][0]+size_px/2,ps[k][1]+size_px/2)));unused.remove(tid);error=math.dist(center,(ps[tid][0]+size_px/2,ps[tid][1]+size_px/2));extent=max(abs(ex-bx-size_px),abs(ey-by-size_px));max_centroid_error=max(max_centroid_error,error);max_extent_error=max(max_extent_error,extent);min_component_area=min(min_component_area,area);max_component_area=max(max_component_area,area)
     assert error<=2.5 and extent<=3,(name,frame,'token pose/extent',tid,error,extent);assert .7*size_px**2<=area<=1.3*size_px**2,(name,frame,'token area',tid,area,size_px**2);position_checks+=1
   else:
    for b in bars:
     color=colors[b['color']]
     for fraction in [.2,.5,.8]:
      x=(b['x']+b['width']*fraction)*q;y=(b['y']+b['height']/2)*q;actual=arr[round(y),round(x)].astype(np.int16);assert np.max(np.abs(actual-color))<=24,(name,frame,'bar interior',b,actual.tolist());bar_checks+=1
  assert proc.stdout.read(1)==b'';err=proc.stderr.read();assert proc.wait()==0,err
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'arithmeticChecks':arithmetic,'sampledFrames':sampled,'allTrayFrames':tray_frames,'componentCountChecks':component_checks,'tokenPoseChecks':position_checks,'tokenCoreChecks':core_checks,'outsideBoundsChecks':outer_checks,'barChecks':bar_checks,'observedBlueAreaRange':[min(blue_counts),max(blue_counts)],'componentPixelAreaRange':[min_component_area,max_component_area],'maximumCentroidErrorAt720':max_centroid_error,'maximumExtentErrorAt720':max_extent_error,'maximumBluePixelsOutsideBounds':max_noise,'failures':0,'tolerances':{'nativeGeometry':1e-7,'coreRgbPerChannel':24,'blueMinusRed':35,'blueMinusGreen':25,'componentMinimumFraction':.5,'matchedAreaFractionRange':[.7,1.3],'matchedCentroidAt720':2.5,'matchedExtentAt720':3,'boundsExpansionAt720':2,'maximumOutsideBluePixels':4},'limits':['Complete tray-frame coverage at720px; final comparisons sampled at2Hz','Component counts and positions are paired with exact native constant-area geometry; compressed pixel areas are not exact quantitative areas','No continuous subjective playback or unsupported-layout acceptance']}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
