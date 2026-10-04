import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {mux} from '../engine/lib/audio.mjs';
import {ffmpeg, pcmToWav} from '../engine/lib/util.mjs';

test('native mux signals sRGB in container and H.264 while preserving picture samples and duration', async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cf-native-color-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const video=path.join(root,'native.mp4'),audio=path.join(root,'short.wav');
  // A tiny video with the old transfer tag exercises the actual mux correction.
  await ffmpeg(['-y','-f','lavfi','-i','testsrc2=size=160x96:rate=24',
    '-frames:v','6','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',
    '-colorspace','smpte170m','-color_primaries','bt709','-color_trc','bt709',
    '-color_range','tv',video]);
  fs.writeFileSync(audio,pcmToWav(Buffer.alloc(4800*2),{sampleRate:48000}));
  function run(bin,args){
    const r=spawnSync(bin,args,{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);return r.stdout;
  }
  function probe(file){
    return JSON.parse(run('ffprobe',['-v','error','-threads','1','-count_frames','-show_streams','-of','json',file])).streams;
  }
  function pictureHashes(file){
    return run('ffmpeg',['-v','error','-threads','1','-i',file,'-map','0:v:0',
      '-threads','1','-f','framemd5','-']).split('\n').filter(line=>line&&!line.startsWith('#'))
      .map(line=>line.split(',').at(-1).trim());
  }
  // Probe the actual MP4 colr atom too: ffprobe can prefer the codec's VUI.
  function containerColor(file){
    const bytes=fs.readFileSync(file);
    function visit(start,end){
      for(let at=start;at+8<=end;){
        let size=bytes.readUInt32BE(at),header=8;
        if(size===1){size=Number(bytes.readBigUInt64BE(at+8));header=16;}
        if(size===0)size=end-at;
        assert.ok(size>=header&&at+size<=end,'valid MP4 box bounds');
        const kind=bytes.toString('ascii',at+4,at+8),body=at+header;
        if(kind==='colr')return {
          kind:bytes.toString('ascii',body,body+4),
          primaries:bytes.readUInt16BE(body+4),transfer:bytes.readUInt16BE(body+6),
          matrix:bytes.readUInt16BE(body+8),fullRange:bytes[body+10]>>7,
        };
        const skip=['moov','trak','mdia','minf','stbl'].includes(kind)?0:kind==='stsd'?8:kind==='avc1'?78:null;
        if(skip!==null){const found=visit(body+skip,at+size);if(found)return found;}
        at+=size;
      }
    }
    return visit(0,bytes.length);
  }
  const original=pictureHashes(video);
  assert.equal(original.length,6);
  for(const withAudio of [false,true]){
    const output=path.join(root,withAudio?'with-audio.mp4':'silent.mp4');
    await mux(video,withAudio?audio:null,output);
    const streams=probe(output),v=streams.find(s=>s.codec_type==='video');
    assert.equal(streams.some(s=>s.codec_type==='audio'),withAudio);
    assert.equal(v.nb_read_frames,'6');assert.equal(v.avg_frame_rate,'24/1');
    assert.equal(v.duration,'0.250000');
    assert.deepEqual(pictureHashes(output),original);
    assert.deepEqual(containerColor(output),{kind:'nclx',primaries:1,transfer:13,matrix:6,fullRange:0});
    const elementary=output+'.h264';
    await ffmpeg(['-y','-i',output,'-map','0:v:0','-c:v','copy','-bsf:v','h264_mp4toannexb','-f','h264',elementary]);
    for(const stream of [v,probe(elementary)[0]]){
      assert.equal(stream.color_transfer,'iec61966-2-1');
      assert.equal(stream.color_primaries,'bt709');
      assert.equal(stream.color_space,'smpte170m');
      assert.equal(stream.color_range,'tv');
      assert.equal(stream.sample_aspect_ratio,'1:1');
    }
  }
});
