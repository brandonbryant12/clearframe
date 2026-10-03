import pathlib,subprocess,json,hashlib
HERE=pathlib.Path(__file__).resolve().parent;KIT=HERE.parents[1]
names=['inspection-orbit-landscape','inspection-orbit-vertical','parallax-truck-landscape','parallax-truck-vertical'];times=[.1,1.2,2.,3.6,4.5,5.95,6.5,7.95];rows=[]
for name in names:
 video=KIT/'media'/name/'clip.mp4';out=HERE/'source-frames'/name;out.mkdir(parents=True,exist_ok=True);frames=[]
 for sec in times:
  p=out/f'{sec:g}s.png';subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-ss',str(sec),'-i',str(video),'-frames:v','1','-vf','scale=360:-2','-threads','1',str(p)],check=True);frames.append({'time':sec,'path':str(p.relative_to(KIT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 rows.append({'name':name,'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'width':360,'frames':frames,'visuallyInspected':False})
(HERE/'source-frames.json').write_text(json.dumps(rows,indent=2)+'\n');print('Decoded',sum(len(r['frames']) for r in rows),'source frames.')
