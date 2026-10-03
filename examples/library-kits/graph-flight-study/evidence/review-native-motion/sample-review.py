"""Bounded encoded-frame extraction for independent visual review; no render."""
from pathlib import Path
import json,hashlib,subprocess,math
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[5]
BASE=ROOT/'examples/library-kits/graph-flight-study'
OUT=Path(__file__).parent
NAMES=['reserve-path-landscape','reserve-path-vertical','seasonal-workload-landscape','seasonal-workload-vertical']
FRAMES=[0,48,96,144,162,168,174,180,186,192,198,204,210,216,222,228,234,240,246,252,276,312,322,323,324,325,327,330,336,408,443]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'scriptSha256':sha(Path(__file__)),'fps':24,'sampleFramesZeroBased':FRAMES,'cases':[]}
for name in NAMES:
 e=BASE/'evidence/reading-hold-v2'/name;out=OUT/name;out.mkdir(exist_ok=True)
 video=e/'native-video.mp4';before=sha(video)
 probe=json.loads(subprocess.check_output(['/opt/homebrew/bin/ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames:format=duration','-of','json',str(video)]))
 selection='+'.join('eq(n,%d)'%n for n in FRAMES)
 subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-threads','1','-i',str(video),'-vf','select='+selection.replace(',',r'\,'),'-fps_mode','vfr','-threads','1',str(out/'frame-%03d.png')],check=True)
 ims={f:out/('frame-%03d.png'%(i+1)) for i,f in enumerate(FRAMES)}
 for label,fs,cols,cw in [('late-flight',[f for f in FRAMES if 162<=f<=252],4,240 if 'vertical' in name else 400),('label-reveal',[322,323,324,325,327,330,336],4,270 if 'vertical' in name else 480)]:
  first=Image.open(ims[fs[0]]);ch=round(first.height*cw/first.width);sheet=Image.new('RGB',(cols*cw,math.ceil(len(fs)/cols)*(ch+24)),(242,242,242));d=ImageDraw.Draw(sheet)
  for i,f in enumerate(fs):
   im=Image.open(ims[f]).resize((cw,ch),Image.Resampling.LANCZOS);x=(i%cols)*cw;y=(i//cols)*(ch+24);sheet.paste(im,(x,y+24));d.text((x+5,y+5),'frame %d / %.3fs'%(f,f/24),fill=(0,0,0))
  sheet.save(out/(label+'.png'))
 im=Image.open(ims[408]);im.resize((360,round(im.height*360/im.width)),Image.Resampling.LANCZOS).save(out/'ending-phone-360.png')
 assert sha(video)==before
 manifest['cases'].append({'name':name,'video':str(video.relative_to(ROOT)),'videoSha256':before,'probe':probe,'frames':[{'index':f,'seconds':f/24,'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for f,p in ims.items()]})
 print(name,probe,flush=True)
(OUT/'sampling.json').write_text(json.dumps(manifest,indent=2)+'\n')
