import fs from 'node:fs';
import { API } from '../../skills/gemini-tts/scripts/tts.mjs';
const base = new URL(API);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const headers = key => {if(!key)throw new Error('GEMINI_API_KEY is not set');return {'x-goog-api-key':key};};
async function request(url,options={}) {
  const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(180_000)});
  if(!r.ok)throw new Error(`Google Files HTTP ${r.status}`);return r;
}
export function fileName(uri) {
  if(typeof uri!=='string')throw new Error('Missing Google file URI');
  if(uri.startsWith('https:')||uri.startsWith('http:')){const u=new URL(uri);if(u.origin!==base.origin)throw new Error('Untrusted Google file URI');uri=u.pathname;}
  const id=uri.match(/(?:^|\/)files\/([a-zA-Z0-9_-]+)(?=:download|\?|$)/)?.[1];if(!id)throw new Error('Invalid Google file URI');return `files/${id}`;
}
export async function waitFile(name,{key=process.env.GEMINI_API_KEY,timeoutMs=180_000,pollMs=2000}={}) {
  const end=Date.now()+timeoutMs;while(true){const f=await (await request(`${API}/${fileName(name)}`,{headers:headers(key)})).json();const state=typeof f.state==='string'?f.state:f.state?.name;if(state==='ACTIVE')return f;if(state==='FAILED')throw new Error('Google file processing failed');if(Date.now()>=end)throw new Error('Google file processing timed out');await sleep(pollMs);}
}
export async function uploadAudio(file,{key=process.env.GEMINI_API_KEY}={}) {
  const bytes=fs.readFileSync(file);if(!bytes.length||bytes.length>50*1024*1024)throw new Error('Speech upload must be a nonempty WAV under 50 MB; split longer recordings into beats.');
  const r=await request(`${base.origin}/upload/v1beta/files`,{method:'POST',headers:{...headers(key),'content-type':'application/json','X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(bytes.length),'X-Goog-Upload-Header-Content-Type':'audio/wav'},body:JSON.stringify({file:{display_name:'ClearFrame speech alignment'}})});
  const uri=r.headers.get('x-goog-upload-url');if(!uri||new URL(uri).origin!==base.origin)throw new Error('Invalid resumable upload URL');
  const result=await (await request(uri,{method:'POST',headers:{'content-length':String(bytes.length),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body:bytes})).json();
  if(!result.file?.uri||!result.file?.name)throw new Error('Missing uploaded file metadata');return result.file;
}
export async function deleteFile(name,{key=process.env.GEMINI_API_KEY}={}) {await request(`${API}/${fileName(name)}`,{method:'DELETE',headers:headers(key)});}
export async function downloadVideo(uri,{key=process.env.GEMINI_API_KEY,pollMs,timeoutMs}={}) {
  const name=fileName(uri);await waitFile(name,{key,pollMs,timeoutMs});
  let url=`${API}/${name}:download?alt=media`;
  for(let redirects=0;redirects<=5;redirects++){
    const r=await fetch(url,{headers:new URL(url).origin===base.origin?headers(key):{},redirect:'manual',signal:AbortSignal.timeout(180_000)});
    if(r.status>=300&&r.status<400){const location=r.headers.get('location');if(!location)throw new Error('Missing download redirect');const next=new URL(location,url);if(next.protocol!=='https:')throw new Error('Insecure video download redirect');url=next.href;continue;}
    if(!r.ok)throw new Error(`Video download HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('Too many video download redirects');
}
