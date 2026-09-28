// Offline integration fixture: isolated OS-TTS words have measured sample boundaries.
// This verifies the renderer clock, not recognition quality on continuous speech.
import fs from 'node:fs';
import path from 'node:path';
import { draftVoice, speechSegments } from '../engine/lib/audio.mjs';
import { pcmToWav, wavDuration, writeJSON, ffmpeg } from '../engine/lib/util.mjs';
import { importSpeech } from '../engine/lib/speech.mjs';
import { scaffold } from '../fframes/playbooks.mjs';
import { checkProject, renderProject, sheetProject } from '../fframes/production.mjs';
const root=path.resolve(process.argv[2]??'build/speech-smoke');
if(fs.existsSync(path.join(root,'storyboard.json')))throw new Error('Smoke fixture already exists; choose a new output path in the script to retain evidence.');
scaffold(root,{playbook:'speech-story',theme:'ink'});
const sb=JSON.parse(fs.readFileSync(path.join(root,'storyboard.json'),'utf8'));
const words=['Make','each','word','count.'];
const folder=path.join(root,'assets/source');fs.mkdirSync(folder,{recursive:true});
const chunks=[],timings=[];let cursor=0;
function pcm(file){const bytes=fs.readFileSync(file);let at=12;while(at+8<=bytes.length){const n=bytes.readUInt32LE(at+4);if(bytes.toString('ascii',at,at+4)==='data')return bytes.subarray(at+8,Math.min(bytes.length,at+8+n));at+=8+n+(n%2);}throw new Error('No PCM data');}
for(const [i,word] of words.entries()){
  const file=path.join(folder,`word-${i}.wav`);await draftVoice(word,file,{wpm:145});const {segments}=await speechSegments(file);const data=pcm(file),duration=data.length/48000;
  chunks.push(data);timings.push({w:word,t0:cursor+(segments[0]?.start??0),t1:cursor+(segments.at(-1)?.end??duration)});cursor+=duration;
  const silence=Buffer.alloc(48000*0.2);chunks.push(silence);cursor+=.2;
}
const take=path.join(folder,'take.wav');fs.writeFileSync(take,pcmToWav(Buffer.concat(chunks)));writeJSON(path.join(folder,'words.json'),{words:timings});
for(const b of sb.beats){b.vo=words.join(' ');b.props.maxWords=4;b.transition='cut';}
sb.theme={base:'ink',accent:'#d6acff'};sb.motion={preset:'spring',intensity:.45};sb.music=false;
writeJSON(path.join(root,'storyboard.json'),sb);
for(const b of sb.beats)await importSpeech(root,{beat:b.id,audio:take,transcript:words.join(' '),words:{words:timings}});
const check=await checkProject(root);writeJSON(path.join(root,'build/check.json'),check);if(check.errors.length)throw new Error(check.errors.join('\n'));
await sheetProject(root,{per:3,thumb:270});
const report=await renderProject(root);console.log(JSON.stringify({root,seconds:wavDuration(take),timings,report},null,2));
