// Compose retained Blender pixels with editable native text in two formats.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadStoryboard} from '../../../engine/lib/project.mjs';
import {computeTiming} from '../../../engine/lib/timing.mjs';
import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
for(const preset of ['landscape','vertical']){
  const master=path.join(root,'media',preset), receipt=JSON.parse(fs.readFileSync(path.join(master,'receipt.json')));
  if(receipt.status!=='ready-for-review')throw Error(`Incomplete ${preset} asset`);
  const width=preset==='landscape'?1920:1080,height=preset==='landscape'?1080:1920,margin=width*(preset==='vertical'?.105:.055);
  const dir=path.join(root,`gate-${preset}`);fs.mkdirSync(path.join(dir,'media'),{recursive:true});
  fs.copyFileSync(path.join(master,'clip.mp4'),path.join(dir,'media/clip.mp4'));
  const sb={version:2,title:'One gate controls access',format:{preset,fps:30},theme:'research-paper',type:'inter',backdrop:'none',
    motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,
    assets:[{id:'reserve-gate',kind:'clip',file:'media/clip.mp4'}],
    sources:[{claim:'The mechanism illustrates a closed path becoming accessible. Geometry does not encode data.',source:'Original procedural sculpture; qualitative illustration.'}],
    beats:[{id:'gate',block:'canvas',duration:6,camera:'none',exit:'none',
      plate:{asset:'reserve-gate',side:'full',treatment:'none',drift:'none',scrim:0,loop:false},
      props:{source:'Qualitative mechanism. No flow or quantity is represented.',sourceSize:width*.03,view:[0,0,width,height],elements:[
        {id:'gate-title',type:'text',text:'One gate controls access',x:margin,y:height*.14,size:width*.041,width:width-2*margin,height:height*.1,font:'display',fill:'ink',at:0,enter:'none'},
        {id:'gate-sequence',type:'text',text:preset==='landscape'?'Closed → opening → open':'Closed → opens once → holds open',x:margin,y:height*.23,size:width*.03,fit:width-2*margin,font:'text',fill:'ink',at:0,enter:'none'}
      ]}}]};
  fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');
  const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
}
console.log('Two native gate specimens compiled.');
