"""Read-only verification of retained source/native bindings; writes this review only."""
from pathlib import Path
import json,hashlib,datetime
ROOT=Path(__file__).resolve().parents[5];BASE=ROOT/'examples/library-kits/graph-flight-study';OUT=Path(__file__).parent
NAMES=['reserve-path-landscape','reserve-path-vertical','seasonal-workload-landscape','seasonal-workload-vertical']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
source_files=['scripts/blender/chart_scene.py','scripts/blender/camera_rig.py','examples/library-kits/graph-flight-study/check-scene.py','examples/library-kits/graph-flight-study/check-encoded.py','examples/library-kits/graph-flight-study/build.mjs','examples/library-kits/graph-flight-study/export-anchors.py','examples/library-kits/graph-flight-study/inputs.json','examples/library-kits/graph-flight-study/timing-reading-hold-v2.json']
source_hashes={f:sha(ROOT/f) for f in source_files};inputs=read(BASE/'inputs.json');sampling=read(OUT/'sampling.json');cases=[]
for name in NAMES:
 e=BASE/'evidence/reading-hold-v2'/name;m=BASE/'media/reading-hold-v2'/name;s=BASE/'specimens/reading-hold-v2'/name
 b=read(e/'bindings.json');a=read(m/'ending-anchors.json');r=read(m/'receipt.json');sc=read(m/'scene-checks.json');review=read(e/'review/review.json');job=read(e/'native-job.json');check=read(e/'native-check.txt');qa=read(e/'qa/qa.json')
 render_text=(e/'native-render.txt').read_text();render=json.loads(render_text[render_text.index('\n{\n')+1:])
 assert sha(BASE/'inputs.json')==b['inputSha256'];assert sha(BASE/'build.mjs')==b['builderSha256'];assert sha(m/'ending-anchors.json')==b['anchorSha256'];assert sha(s/'storyboard.json')==b['storyboardSha256'];assert sha(s/'bindings.json')==sha(e/'bindings.json')
 for f,h in r['sourceHashes'].items():assert sha(ROOT/f)==h,(name,f,'source changed')
 for f,h in r['outputs'].items():assert sha(m/f)==h['sha256'],(name,f,'receipt mismatch')
 assert sha(m/'clip.mp4')==a['sourceClipSha256']==b['sourceClipSha256']==sha(s/'media/clip.mp4')
 assert sha(m/'scene.blend')==a['sceneSha256']==sc['sceneSha256'];assert sha(m/'receipt.json')==a['receiptSha256'];assert sha(BASE/'export-anchors.py')==a['exporterSha256'];assert sha(BASE/'check-scene.py')==sc['checkerSha256']
 assert a['status']==sc['status']=='pass' and sc['framesChecked']==445 and sc['backdropRayChecks']==11125 and sc['ceilingVisibleFrames']==0
 assert b['frames']==job['frames']==render['frames']==444 and b['fps']==job['fps']==render['fps']==24
 assert a['holdFramesChecked']==120 and a['visibleFromSeconds']==b['labelsVisibleFromSeconds']==13.5 and b['labelsFullyVisibleSeconds']==13.75
 native_sha=sha(e/'native-video.mp4');assert native_sha==render['outputSha256']==review['outputSha256']==next(c for c in sampling['cases'] if c['name']==name)['videoSha256']
 assert render['inputId']==review['inputId']==check['inputId'];assert render['hashes']['storyboard.json']==b['storyboardSha256'];assert render['hashes']['media/clip.mp4']==b['sourceClipSha256'];assert render['draft'] is True
 item=next(i for i in inputs['cases'] if name.startswith(i['id']));els=job['beats'][0]['props']['elements'];lookup={x['id']:x for x in els}
 assert [v['value'] for v in a['observations']]==item['values'];assert [v['value'] for v in a['ticks']]==item['ticks']
 for i,v in enumerate(item['values']):
  expected=item['valuePrefix']+format(v*item['valueMultiplier'],',')+item['valueSuffix']
  assert lookup['value-'+str(i)]['text']==expected;assert lookup['month-'+str(i)]['text']==item['periods'][i]
 ending=[x for x in els if x['id'].startswith(('tick-','month-','value-')) or x['id']=='axis-unit'];assert all(x['at']==13.5 and x['dur']==.25 and x['enter']=='fade' for x in ending)
 assert not check['errors'];assert qa['summary']['frames']==444 and qa['summary']['seconds']==18.5
 encoded=read(e/'encoded-checks.json')
 assert encoded['status']=='pass' and encoded['checkerSha256']==sha(BASE/'check-encoded.py')
 for key,p in [('videoSha256',e/'native-video.mp4'),('nativeJobSha256',e/'native-job.json'),('bindingsSha256',e/'bindings.json'),('anchorsSha256',m/'ending-anchors.json'),('inputSha256',BASE/'inputs.json')]:assert encoded[key]==sha(p),(name,key)
 assert encoded['endingFramesChecked']==114 and len(encoded['registrationSamples'])==9 and not encoded['colorFidelityAccepted']
 artifacts=[e/'encoded-checks.json',e/'native-video.mp4',e/'ending-17s.png',e/'native-job.json',e/'native-audit.json',e/'bindings.json',e/'native-check.txt',e/'native-render.txt',e/'native-qa.txt',e/'qa/phone.png',e/'qa/timeline.png',e/'qa/qa.json',e/'review/review.json',m/'receipt.json',m/'ending-anchors.json',m/'scene-checks.json',s/'storyboard.json']
 cases.append({'name':name,'status':'bindings-pass','nativeVideoSha256':native_sha,'nativeInputId':render['inputId'],'draft':True,'encodedDimensions':[render['width'],render['height']],'fps':24,'frames':444,'sourceChecks':{'frames':445,'stageRays':11125,'ceilingVisibleFrames':0,'currentCheckerHashVerified':True},'labels':{'fromSeconds':13.5,'fullSeconds':13.75,'readingEndSeconds':18.5,'fullyLabeledFrameCount':114,'valuesAndMonthsMatchInputs':True},'encodedCheck':{'maximumEdgeErrorPixels':encoded['maximumEdgeErrorPixels'],'registrationSamples':9,'neighborComparisons':18,'colorFidelityAccepted':False},'nativeWarnings':check['warnings'],'qaFindings':qa['findings'],'artifactHashes':{str(p.relative_to(ROOT)):sha(p) for p in artifacts}})
assert source_hashes=={f:sha(ROOT/f) for f in source_files}
report={'status':'pass','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scriptSha256':sha(Path(__file__)),'sourceHashes':source_hashes,'cases':cases,'limits':['Read-only verification of existing receipts, source hashes, retained encoded bytes, declared native elements, and input data. No re-render performed.','Renderer executable reproducibility is not independently established by this hash comparison.','This is not a source/native pixel-registration check or quantitative encoded bar-height measurement; those belong to the separate checker.','Native draft outputs are 960x540 or 540x960; authored full-size stills are not proof of full-resolution encoded output.']}
(OUT/'bindings-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'pass','cases':len(cases),'hashes':[{'name':c['name'],'video':c['nativeVideoSha256']} for c in cases]},indent=2))
