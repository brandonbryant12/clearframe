"""Independent sample arithmetic, geometry and encoded observations.
No JS model imports. Bounded 2Hz probes plus motion/cut frames; two FFmpeg threads.
"""
import hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def rgb(data,w,h,x,y):
 x=round(x);y=round(y);assert 0<=x<w and 0<=y<h
 return data[(y*w+x)*3:(y*w+x)*3+3]
def blue(v):r,g,b=v;return b-r>28 and b-g>20
def ink(v):return max(v)<160

def mark(data,w,h,x,y,pred,radius=2):
 return any(pred(rgb(data,w,h,i,j)) for j in range(max(0,round(y)-radius),min(h,round(y)+radius+1)) for i in range(max(0,round(x)-radius),min(w,round(x)+radius+1)))
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json');reports=[]
for a in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==a['caseId']);name=a['name'];folder=ROOT/'evidence'/name;job=read(folder/'native-job.json');video=folder/'video.mp4';W,H=job['width'],job['height'];w=720;h=round(w*H/W);q=w/W;tall=H>W
 assert job['frames']==1920 and job['fps']==30 and [b['frames'] for b in job['beats']]==[960,960]
 vals=[(i,v) for i,v in enumerate(c['observations']) if v is not None];n=len(vals);edges=c['edges'];t=c['threshold'];qual=lambda v:{'gte':v>=t['value'],'gt':v>t['value'],'lte':v<=t['value'],'lt':v<t['value']}[t['relation']]
 tail=[i for i,v in vals if qual(v)];bins=[]
 for i,(lo,hi) in enumerate(zip(edges,edges[1:])):
  members=[j for j,v in vals if lo<=v and (v<hi or i==len(edges)-2 and v==hi)];count=len(members);height=count if c['mode']=='count' else count/(n*(hi-lo));bins.append({'count':count,'height':height,'members':members,'low':lo,'high':hi})
 assert sum(b['count'] for b in bins)==n
 if c['mode']=='density':assert abs(math.fsum(b['height']*(b['high']-b['low']) for b in bins)-1)<1e-14
 left,right=W*.19,W*.89;top,bottom=H*(.31 if tall else .32),H*(.59 if tall else .62);strip=H*(.70 if tall else .74);stripbottom=H*(.79 if tall else .83);r=W*.0055;px=lambda v:left+(v-edges[0])/(edges[-1]-edges[0])*(right-left);py=lambda v:bottom-v/c['y']['max']*(bottom-top)
 native=arithmetic=0;stages=[]
 for bi,b in enumerate(job['beats']):
  ident=b['id'];els={e['id']:e for e in b['props']['elements']};m=a['stages'][bi]['model'];assert m['n']==n and m['missing']==len(c['observations'])-n and m['threshold']['members']==tail and m['threshold']['count']==len(tail);arithmetic+=4
  symbol={'gte':'≥','gt':'>','lte':'≤','lt':'<'}[t['relation']]
  expected=f"{len(tail)} of {n} observed {symbol} {t['value']} {c['unit']}" if bi else f"{n} observed · {len(c['observations'])-n} missing · explicit bins"
  assert els[ident+'-summary']['text']==expected;assert els[ident+'-source']['text']==c['source']+' '+c['asOf']+'.';native+=2
  for j,v in enumerate(c['y']['ticks']):near(els[f'{ident}-grid-{j}']['y1'],py(v));assert els[f'{ident}-y-{j}']['text']==f"{v:.{c['y']['decimals']}f}";native+=2
  for j,v in enumerate(edges):near(els[f'{ident}-x-{j}']['x'],px(v));assert els[f'{ident}-x-{j}']['text']==str(v);native+=2
  bars=[];points=[]
  for i,bb in enumerate(bins):
   ab=m['bins'][i];assert ab['count']==bb['count'] and ab['members']==bb['members'];near(ab['height'],bb['height']);arithmetic+=3
   x,y,bw,bh=px(bb['low']),py(bb['height']),px(bb['high'])-px(bb['low']),bottom-py(bb['height']);at=.4+i*.16 if bi==0 else 0;end=at+.8 if bi==0 else 0
   if bb['count']:
    el=els[f'{ident}-bar-{i}']
    for k,v in [('x',x),('y',y),('w',bw),('h',bh)]:near(el[k],v);native+=1
    if bi==0:
     assert el['origin']==[x,bottom] and el['keys'][0]=={'at':0,'scaleY':0,'dur':0};key=el['keys'][1];near(key['at'],at);near(key['dur'],.8);assert key['scaleY']==1 and key['ease']=='linear';native+=5
   else:assert f'{ident}-bar-{i}' not in els;native+=1
   label=els[f'{ident}-count-{i}'];assert label['text']==f"n={bb['count']}";near(label['at'],end);native+=2
   bars.append({'x':x,'y':y,'w':bw,'h':bh,'at':at,'end':end})
  rows=[]
  for idx,value in sorted(vals,key=lambda z:(z[1],z[0])):
   x=px(value);row=next((i for i,last in enumerate(rows) if x-last>=3*r+3),len(rows))
   if row==len(rows):rows.append(x)
   else:rows[row]=x
   y=strip+row*(3*r+3);p=els[f'{ident}-sample-{idx}'];near(p['cx'],x);near(p['cy'],y);near(p['r'],r);assert p['fill']=='accent';native+=4
   selected=bi==1 and qual(value);ring=els.get(f'{ident}-selected-{idx}')
   if selected:assert ring['fill']=='none' and ring['stroke']=='ink';near(ring['r'],r*1.3);near(ring['at'],.45);native+=4
   else:assert ring is None;native+=1
   points.append({'x':x,'y':y,'selected':selected})
  if bi==1:
   for j,(y1,y2) in enumerate([(top,bottom),(strip-r*1.5,stripbottom)]):
    e=els[f'{ident}-threshold-{j}'];near(e['x1'],px(t['value']));near(e['x2'],px(t['value']));near(e['y1'],y1);near(e['y2'],y2);near(e['at'],.2);near(e['dur'],.8);assert e['drawEase']=='linear';native+=7
  stages.append({'bars':bars,'points':points})
 frames=sorted(set(range(0,1920,15))|{11,12,17,18,23,24,29,30,35,36,41,42,47,48,959,960,961,965,966,973,974,989,990,1919});expr='+'.join(f'eq(n\\,{v})' for v in frames)
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sampled=fills=empty=points=rings=fronts=thresholds=0
 try:
  for frame in frames:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need);assert chunk,('short decode',name,frame);chunks.append(chunk);need-=len(chunk)
   data=b''.join(chunks);sampled+=1;bi=0 if frame<960 else 1;local=(frame-bi*960)/30
   for b in stages[bi]['bars']:
    progress=max(0,min(1,(local-b['at'])/.8)) if bi==0 else 1;current=b['h']*progress;mid=b['x']+b['w']*.35
    # Stay clear of borders, labels and the exact threshold stroke.
    if current*q>6:
     X,Y=mid*q,(bottom-current*.5)*q;assert mark(data,w,h,X,Y,blue,1),(name,frame,'bar interior',b);fills+=1
    if bi==0 and .15<progress<.85 and b['h']*q>12:
     X,Y=mid*q,(bottom-current+1/q)*q;assert mark(data,w,h,X,Y,blue,2),(name,frame,'bar front',b);fronts+=1
     X,Y=mid*q,(bottom-current-5/q)*q;assert not mark(data,w,h,X,Y,blue,1),(name,frame,'bar above front',b);empty+=1
   for p in stages[bi]['points']:
    X,Y=p['x']*q,p['y']*q;assert mark(data,w,h,X,Y,blue,1),(name,frame,'sample point',p);points+=1
    if p['selected'] and local>=.45:
     for side in [-1,1]:assert mark(data,w,h,X+side*r*1.3*q,Y,ink,1),(name,frame,'selected outline',p);rings+=1
   if bi==1 and local>=1:
    X=px(t['value'])*q;Y=(top+(bottom-top)*.8)*q;assert mark(data,w,h,X,Y,ink,1),(name,frame,'threshold');thresholds+=1
  assert proc.stdout.read(1)==b'';err=proc.stderr.read();assert proc.wait()==0,err
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'arithmeticChecks':arithmetic,'sampledFrames':sampled,'barFillChecks':fills,'frontChecks':fronts,'aboveFrontChecks':empty,'pointChecks':points,'outlineChecks':rings,'thresholdChecks':thresholds,'failures':0,'tolerances':{'geometryPixels':1e-7,'pointRadiusAt720':1,'outlineRadiusAt720':1,'frontRadiusAt720':2}}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
