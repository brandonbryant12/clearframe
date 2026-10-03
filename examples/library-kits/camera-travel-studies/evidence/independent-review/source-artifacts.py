"""Bind reviewed masters and inspect producer geometry/replay evidence without Blender."""
import hashlib,json,math,pathlib
HERE=pathlib.Path(__file__).resolve().parent;KIT=HERE.parents[1];ROOT=HERE.parents[4]
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
frames=read(HERE/'source-frames.json');rows=[]
for f in frames:
 name=f['name'];media=KIT/'media'/name;evidence=KIT/'evidence'/name;r=read(media/'receipt.json');cam=read(evidence/'camera.json');verify=read(evidence/'verification.json');model=r['blender']['cameraRig'];pose=model['pose'];phases=r['config']['motion']['poseSamples'];safe=r['blender']['cameraReview']['safe']
 assert r['status']=='ready-for-review' and r['config']['loop'] is False
 assert r['config']['frames']==192 and r['config']['fps']==24 and len(phases)==193
 assert r['probe']['nb_read_frames']=='192' and r['probe']['avg_frame_rate']=='24/1'
 assert cam['sceneSha256']==sha(media/'scene.blend') and cam['receiptSha256']==sha(media/'receipt.json')
 for p,h in r['sourceHashes'].items():assert sha(ROOT/p)==h and sha(media/'source'/pathlib.Path(p).name)==h
 for p,entry in r['outputs'].items():assert sha(media/p)==entry['sha256']
 assert f['videoSha256']==sha(media/'clip.mp4') and f['visuallyInspected'] and len(f['frames'])==8
 for frame in f['frames']:assert sha(KIT/frame['path'])==frame['sha256']
 assert cam['status']=='pass' and cam['seekEqual'] and cam['framesChecked']==193 and cam['maxStaticDrift']==0
 assert verify['status']=='passed-mechanical-checks' and len(verify['cases'])==1
 replay=verify['cases'][0];assert replay['reloadWithinTolerance'] and replay['reloadDifference']['changedChannels']<=1 and replay['reloadDifference']['maxDifference']<=1
 assert r['blender']['bakedMotion'] and r['blender']['requiresAutoExec'] is False
 assert all(h['maxTransformError']==0 and h['maxCameraOpticsError']==0 for h in r['blender']['holdTransformChecks'])
 maxerr=0
 for i,(phase,s)in enumerate(zip(phases,cam['samples'])):
  assert s['frame']==i+1 and s['phase']==phase
  t=min(1,max(0,(phase-model['move'][0])/(model['move'][1]-model['move'][0])));t=t*t*(3-2*t) if model['ease']=='smooth' else t
  if model['preset']=='orbit':
   dx,dy=[a-b for a,b in zip(pose['location'][:2],pose['target'][:2])];theta=math.atan2(dy,dx)+math.radians(model['degrees'])*t;radius=math.hypot(dx,dy);expected=[pose['target'][0]+radius*math.cos(theta),pose['target'][1]+radius*math.sin(theta),pose['location'][2]]
  else:expected=[p+d*t for p,d in zip(pose['location'],model['translation'])]
  error=max(abs(a-b)for a,b in zip(expected,s['camera']));assert error<2e-6;maxerr=max(maxerr,error)
  b=s['bounds'];assert b[0]>=safe[0]-1e-5 and b[1]>=safe[1]-1e-5 and b[2]<=safe[2]+1e-5 and b[3]<=safe[3]+1e-5
 for phase,s in zip(phases,cam['samples']):
  if phase<=model['move'][0]:assert s['camera']==cam['samples'][0]['camera']
  if phase>=model['move'][1]:assert s['camera']==cam['samples'][-1]['camera']
 if model['preset']=='truck':
  start,end=cam['samples'][0],cam['samples'][-1];front=end['foreground'][0]-start['foreground'][0];rear=end['marker'][0]-start['marker'][0];ratio=front/rear;expected=start['markerDepth']/start['foregroundDepth'];assert front<rear<0 and ratio>1.03 and abs(ratio-expected)<1e-5;assert ratio==cam['parallax']['ratio']
 rows.append({'name':name,'sourceClipSha256':sha(media/'clip.mp4'),'sourceReceiptSha256':sha(media/'receipt.json'),'sceneSha256':sha(media/'scene.blend'),'cameraReportSha256':sha(evidence/'camera.json'),'replayReportSha256':sha(evidence/'verification.json'),'sourceHashes':r['sourceHashes'],'duration':8,'frames':192,'fps':24,'bakedFramesChecked':193,'sourceCaptures':8,'inspected':True,'maxIndependentRecordedCameraError':maxerr,'staticDrift':0,'seekEqual':True,'replayPixelsMatch':replay['reloadPixelsMatch'],'replayWithinTolerance':replay['reloadWithinTolerance'],'replayDifference':replay['reloadDifference'],'holdTransformsAndOpticsExact':True,'parallax':cam.get('parallax')})
(HERE/'source-artifacts.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps({'status':'pass','masters':len(rows),'inspectedFrames':sum(r['sourceCaptures']for r in rows),'boundBakedFrames':sum(r['bakedFramesChecked']for r in rows),'maxRecordedCameraError':max(r['maxIndependentRecordedCameraError']for r in rows)}))
