import { b } from './definition.mjs';

export const stageBlock = b(
  'stage',
  'graphics',
  'A native GPU stage drawn by the scene engine: actors that keep their identity, links that follow them, packets travelling, callouts riding a moving actor, commit-grounded code edits, GPU materials, particle systems, footage, a 2.5D camera with depth of field and real motion blur.',
  {
    actors:
      '[{id, label, kind: service|database|user|users|queue|process|external|file|client|phone|timer|lock|note|state, x, y (card centre, frame pixels), w?, h?, icon?, status?: neutral|active|added|done|removed|error|waiting, detail?, at|say, z?}]',
    links:
      '[{id?, from, to, label?, route?: curve|straight|elbow, bend?, dashed?, color?, arrow?: end|both|none, at|say}] — connectors that follow their actors',
    events:
      '[{do: send|pulse|highlight|state|move|show|hide|callout|burst|connect|disconnect|camera, at|say, …}]: send {from, to | via, label, color, dur, burst}; state {actor, status, label}; move {actor, x, y, dur}; callout {actor, text, side, untilSay}; camera {x, y, zoom | follow}',
    code: 'Editor whose lines keep their identity: {commit, file, base?, repo?, context?} from git, or {before, after}, or {lines, steps}; {x, y, w, size, title, say|at, focus, gutter}',
    ground:
      'A full-frame GPU material behind the stage: {material: noise|sheen|halftone|grain|glass|chrome|gold|thermal|scanlines|dither, colors, opacity, scale, speed, z}',
    under: 'Native elements (canvas dialect) drawn first',
    elements:
      'Native elements drawn after under, before actors — rect|circle|ellipse|line|path|poly|text|icon|image|video|group|particles|spotlight|shader|code|connector (camera: false pins one to the screen); see docs/scene-engine.md',
    over: 'Native elements drawn last',
    camera:
      'The stage camera: {x, y, zoom, rotate, z, keys: [{at|say, x, y, zoom, rotate, z, dur, ease}], focus: {z, aperture, keys}}',
    shutter: 'Motion-blur shutter, 0–1 of a frame (0.5 = 180°); 0 for none',
    samples: 'Time samples per frame for motion blur (default 8, at most 32)',
    motion: 'Motion preset for the stage: {preset, intensity}',
    z: 'under (default: the stage is the picture) or over the block content',
  },
  {
    title: 'How a stop request travels',
    actors: [
      { id: 'cli', label: 'CLI', kind: 'client', x: 420, y: 560 },
      { id: 'daemon', label: 'Daemon', kind: 'service', x: 960, y: 560 },
      { id: 'child', label: 'Child', kind: 'process', x: 1500, y: 560 },
    ],
    links: [
      { from: 'cli', to: 'daemon', label: 'stop' },
      { from: 'daemon', to: 'child', label: 'SIGTERM' },
    ],
    events: [
      { do: 'send', from: 'cli', to: 'daemon', at: 1.2 },
      { do: 'send', from: 'daemon', to: 'child', at: 2.4, burst: true },
      { do: 'state', actor: 'child', status: 'done', label: 'Exited', at: 3.6 },
    ],
    shutter: 0.5,
  },
);
