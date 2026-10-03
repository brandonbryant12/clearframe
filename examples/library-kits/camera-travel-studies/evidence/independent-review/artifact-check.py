"""Bind final native render identity, timing, frame review and producer probes."""
import hashlib,json,pathlib,subprocess
HERE=pathlib.Path(__file__).resolve().parent;KIT=HERE.parents[1];ROOT=HERE.parents[4]
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
runs=read(KIT/'build/verification.json');binding=read(KIT/'bindings.json');frames=read(HERE/'native-frames.json');holds=read(KIT/'build/encoded-holds.json');registration=read(KIT/'build/registration.json');sources=read(HERE/'source-artifacts.json');report=[]
assert len(runs)==len(frames)==len(holds)==len(registration)==8
assert len({r['name']for r in runs})==8
assert binding['inputSha256']==sha(KIT/'inputs.json')
# Re-decode twelve exact source/hold endpoint frames, independently of stored receipts.
def yuvhash(file,index):
 r=subprocess.run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(file),'-vf',f'select=eq(n\\,{index})','-frames:v','1','-threads','1','-pix_fmt','yuv420p','-f','rawvideo','-'],capture_output=True)
 assert r.returncode==0 and r.stdout
 return hashlib.sha256(r.stdout).hexdigest()
for source in sources:
 media=KIT/'media'/source['name'];hold=read(media/'hold.json');h=yuvhash(media/'clip.mp4',191)
 assert h==hold['sourceYuvSha256']==yuvhash(media/'final-hold.mp4',0)==yuvhash(media/'final-hold.mp4',239)
 assert hold['sourceFrame']==191 and hold['sourceFps']==24 and hold['holdYuvEndpointsEqual']
 assert sha(media/'clip.mp4')==hold['sourceClipSha256']==source['sourceClipSha256']
 assert sha(media/'final-hold.mp4')==hold['holdClipSha256'] and sha(media/'final-frame.png')==hold['sha256']
for r in runs:
 name=r['name'];d=KIT/'evidence'/name;project=KIT/'specimens'/name;receipt=read(d/'video.mp4.json');job=read(d/'native-job.json');b=next(b for b in binding['bindings']if b['name']==name);f=next(f for f in frames if f['name']==name);h=next(x for x in holds if x['name']==name);reg=next(x for x in registration if x['name']==name);source=next(x for x in sources if x['name']==b['mediaName']);media=KIT/'media'/b['mediaName']
 assert receipt['frames']==job['frames']==b['nativeFrames']==540 and receipt['fps']==job['fps']==b['nativeFps']==30
 assert [x['frames']for x in job['beats']]==[240,300]
 assert r['check']['errors']==r['check']['warnings']==[] and r['qa']['pops']==0 and r['seek']['equal'] and r['qa']['seconds']==18
 assert receipt['outputSha256']==sha(d/'video.mp4')==f['videoSha256']==h['videoSha256']==reg['videoSha256']
 assert b['storyboardSha256']==sha(project/'storyboard.json')==receipt['hashes']['storyboard.json']==h['storyboardSha256']==reg['storyboardSha256']
 for file,hashval in receipt['hashes'].items():assert sha(project/file)==hashval
 assert b['sourceClipSha256']==source['sourceClipSha256']==sha(media/'clip.mp4')==sha(project/'media/clip.mp4')==h['sourceClipSha256']==reg['sourceClipSha256']
 assert b['holdClipSha256']==h['holdClipSha256']==sha(media/'final-hold.mp4')==sha(project/'media/final-hold.mp4')
 assert b['heldImageSha256']==h['heldImageSha256']==sha(media/'final-frame.png')==sha(project/'media/final-frame.png')
 assert b['sourceFrames']==192 and b['sourceFps']==24 and b['heldSourceFrame']==191 and b['explicitStaticHoldSeconds']==10
 assert f['visuallyInspected'] and len(f['frames'])==11
 for frame in f['frames']:assert sha(KIT/frame['path'])==frame['sha256']
 assert reg['checkerSha256']==sha(KIT/'check-registration.py') and reg['passed'] and reg['threshold']==1.5 and reg['maximumMeanAbsoluteRgb']<1.5 and len(reg['samples'])==21
 assert h['passed'] and h['frames']==540 and h['anchorFrame']==225 and h['holdFramesChecked']==315 and h['thresholds']=={'hold':.5,'action':1,'boundary':.1}
 assert h['maxHoldDifference']<.5 and h['boundaryDifference']<.1 and h['actionDifference']>1 and h['geometrySha256']==source['cameraReportSha256']
 report.append({'name':name,'pipelineId':r['pipelineId'],'duration':18,'fps':30,'frames':540,'inspected':True,'captures':11,'videoSha256':sha(d/'video.mp4'),'storyboardSha256':sha(project/'storyboard.json'),'nativeJobSha256':sha(d/'native-job.json'),'receiptSha256':sha(d/'video.mp4.json'),'sourceClipSha256':b['sourceClipSha256'],'sourceReceiptSha256':source['sourceReceiptSha256'],'holdClipSha256':b['holdClipSha256'],'heldImageSha256':b['heldImageSha256'],'registrationReportSha256':sha(KIT/'build/registration.json'),'encodedHoldReportSha256':sha(KIT/'build/encoded-holds.json'),'sourceCameraReportSha256':source['cameraReportSha256'],'sourceHoldYuvEndpointsIndependentlyEqual':True,'encodeSeconds':receipt['seconds'],'errors':0,'warnings':0,'pops':0,'seekEqual':True})
(HERE/'artifact-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'pass','nativeVariants':len(report),'viewedNativeFrames':sum(r['captures']for r in report),'independentSourceHoldYuvEndpointDecodes':12}))
