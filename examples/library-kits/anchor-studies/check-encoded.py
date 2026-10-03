"""Independent source projection mapping and bounded encoded registration probes."""
import hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[2]
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def frame(p,n,w,h):
 r=subprocess.run(['ffmpeg','-v','error','-threads','2','-i',str(p),'-vf',f'select=eq(n\\,{n}),scale={w}:{h}','-frames:v','1','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],capture_output=True,check=True)
 assert len(r.stdout)==w*h*3,(p,n,len(r.stdout)); return r.stdout
def rgb(data,w,x,y):
 k=(int(y)*w+int(x))*3; return data[k:k+3]
def distance(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1]; t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
def close(a,b):
 assert len(a)==len(b) and all(abs(x-y)<1e-7 for x,y in zip(a,b)),(a,b)
def dark(data,w,h,x,y,r=2):
 return any(max(rgb(data,w,i,j))<160 for j in range(max(0,round(y)-r),min(h,round(y)+r+1)) for i in range(max(0,round(x)-r),min(w,round(x)+r+1)))
reports=[]
for a in read(ROOT/'audit.json')['results']:
 name=a['name']; evidence=ROOT/'evidence'/name; video=evidence/'video.mp4'; sb=ROOT/'specimens'/name/'storyboard.json'; job=read(evidence/'native-job.json'); m=read(ROOT/'anchors'/f"{a['mediaName']}.json")
 W,H=job['width'],job['height']; w=720; h=round(w*H/W); scale=w/W
 assert job['frames']==840 and job['fps']==30 and [b['frames'] for b in job['beats']]==[240,600]
 assert job['beats'][0]['plate']['loop'] is False and job['beats'][1]['plate']['loop'] is True
 assert all(b['camera']['move']=='none' and b['plate']['drift']=='none' for b in job['beats'])
 raw=next(x for x in m['anchors'] if x['id']==a['anchorId'])['point']; center=[raw[0]*W,raw[1]*H]; close(center,next(x['point'] for x in a['placement']['anchors'] if x['id']==a['anchorId']))
 elements={x['id']:x for x in job['beats'][1]['props']['elements']}; ring=elements['attached-anchor']; line=elements['attached-leader']; radius=W*.004
 close([ring['cx'],ring['cy'],ring['r']],[*center,radius]); close([line['x2'],line['y2']],[center[0],center[1]-radius]); assert line['drawEase']=='linear' and line['at']==.5 and line['dur']==.6
 native=7
 for key,zone in [('title','heading'),('attached-copy','callout'),('source','source')]:
  e=elements[key]; z=next(x for x in m['copyZones'] if x['id']==zone)['rect']; rect=a[{'title':'titleRect','attached-copy':'labelRect','source':'sourceRect'}[key]]
  close([e['x'],e['y']-e['size']*.9,e['width'],e['height']],[rect['x'],rect['y'],rect['width'],rect['height']]); assert rect['x']>=z[0]*W-1e-7 and rect['y']>=z[1]*H-1e-7 and rect['x']+rect['width']<=(z[0]+z[2])*W+1e-7 and rect['y']+rect['height']<=(z[1]+z[3])*H+1e-7; native+=2
 source=REPO/a['sourceAsset']/'clip.mp4'; reference=frame(source,a['heldSourceFrame'],w,h)
 c=[v*scale for v in center]; r=radius*scale; start=[line['x1']*scale,line['y1']*scale]; end=[line['x2']*scale,line['y2']*scale]
 x0,y0,x1,y1=m['subjectBounds']; probes=[(x,y) for y in range(math.ceil(y0*h),math.floor(y1*h),8) for x in range(math.ceil(x0*w),math.floor(x1*w),8) if distance((x,y),start,end)>6 and math.hypot(x-c[0],y-c[1])>r+6]
 assert len(probes)>100
 samples=[]; frontproofs=[]; fronts=0; stable=None; ringchecks=0; leaderchecks=0
 for n in sorted(set([243,258,264,270]+list(range(285,840,15))+[839])):
  data=frame(video,n,w,h); errors=[sum(abs(v-z) for v,z in zip(rgb(data,w,x,y),rgb(reference,w,x,y)))/3 for x,y in probes]
  mean=sum(errors)/len(errors); p95=sorted(errors)[int(len(errors)*.95)]; assert mean<8 and p95<18,(name,n,'plate registration',mean,p95)
  if n>=285:
   px=rgb(data,w,round(c[0]),round(c[1])); assert min(px)>195,(name,n,'anchor center',list(px)); ringchecks+=1
   for dx,dy in [(-r,0),(r,0),(0,r)]:
    assert dark(data,w,h,c[0]+dx,c[1]+dy,1),(name,n,'ring edge',dx,dy); ringchecks+=1
   for f in [.1,.25,.4,.55,.7,.85,.98]:
    assert dark(data,w,h,start[0]+(end[0]-start[0])*f,start[1]+(end[1]-start[1])*f),(name,n,'leader',f)
    leaderchecks+=1
   if stable is None: stable=data
   drift=sum(sum(abs(v-z) for v,z in zip(rgb(data,w,x,y),rgb(stable,w,x,y)))/3 for x,y in probes)/len(probes)
   assert drift<2,(name,n,'held drift',drift)
  if n in [258,264,270]:
   t=(n/30-8-.5)/.6; point=[start[j]+(end[j]-start[j])*t for j in [0,1]]; assert dark(data,w,h,*point),(name,n,'linear front');
   support=[{'xy':[x,y],'encoded':list(rgb(data,w,x,y)),'source':list(rgb(reference,w,x,y))} for y in range(round(point[1])-2,round(point[1])+3) for x in range(round(point[0])-2,round(point[0])+3) if max(rgb(data,w,x,y))<160 and sum(rgb(reference,w,x,y))/3-sum(rgb(data,w,x,y))/3>=35]
   assert support,(name,n,'front contrast against original plate'); fronts+=1
   frontproofs.append({'frame':n,'expected':point,'support':support})
  samples.append({'frame':n,'plateMeanAbsoluteError':mean,'plateP95AbsoluteError':p95})
 reports.append({'project':name,'videoSha256':sha(video),'storyboardSha256':sha(sb),'anchorManifestSha256':sha(ROOT/'anchors'/f"{a['mediaName']}.json"),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'sampledFrames':len(samples),'plateProbesPerFrame':len(probes),'ringChecks':ringchecks,'leaderChecks':leaderchecks,'frontChecks':fronts,'failures':0,'frontProofs':frontproofs,'samples':samples})
 print(json.dumps({k:v for k,v in reports[-1].items() if k not in ['samples','frontProofs']}),flush=True)
(ROOT/'build'/'encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
