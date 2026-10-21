import type { JsonRecord } from '../types.mjs';
import type { DiscoveryExample, CastExamples } from './contracts.mjs';
const OBJ = {
  a: { id: 'a', shape: 'doc', color: 'accent' },
  b: { id: 'b', shape: 'person', color: 'surface' },
  c: { id: 'c', shape: 'server', color: 'accent2' },
  d: { id: 'd', shape: 'box', color: 'accent2' },
};
const ROW = { form: 'line', ids: ['a', 'b', 'c'], at: 0 };
const castOf = (
  formations: JsonRecord[],
  extra: (typeof OBJ.a)[] = [],
): DiscoveryExample => ({
  block: 'canvas',
  props: {
    cast: {
      look: 'drawn',
      objects: [OBJ.a, OBJ.b, OBJ.c, ...extra],
      formations,
    },
  },
});
export const MOVES: CastExamples = {
  scatter: castOf([{ form: 'scatter', ids: ['a', 'b', 'c'], at: 0 }]),
  line: castOf([{ ...ROW, thread: true }]),
  ring: castOf([{ form: 'ring', ids: ['a', 'b', 'c'], at: 0 }]),
  cluster: castOf([{ form: 'cluster', ids: ['a', 'b', 'c'], at: 0 }]),
  hero: castOf([
    ROW,
    { form: 'hero', hero: 'b', word: 'The one who decides', say: 'decides' },
  ]),
  swap: castOf(
    [ROW, { form: 'swap', out: 'a', in: 'd', by: ['b'], say: 'becomes' }],
    [OBJ.d],
  ),
  wave: castOf([ROW, { form: 'wave', ids: ['a', 'b', 'c'], say: 'runs' }]),
  travel: castOf([
    ROW,
    { form: 'travel', ids: ['a'], to: 'c', say: 'goes', dur: 1.2 },
  ]),
  merge: castOf([
    ROW,
    { form: 'merge', ids: ['a', 'b'], into: 'c', say: 'folds' },
  ]),
  split: castOf([
    { form: 'cluster', ids: ['c'], at: 0 },
    { form: 'split', from: 'c', ids: ['a', 'b'], say: 'fans' },
  ]),
  camera: castOf([
    ROW,
    { form: 'camera', zoom: 1.6, on: 'b', say: 'closer' },
    { form: 'camera', zoom: 1, say: 'back' },
  ]),
  exit: castOf([ROW, { form: 'exit', ids: ['a'], say: 'leaves' }]),
  mark: castOf([
    ROW,
    { form: 'mark', mark: 'circle', ids: ['b'], say: 'matters' },
    { form: 'mark', mark: 'arrow', ids: ['a'], to: 'c', say: 'feeds' },
  ]),
};
MOVES.fill = MOVES.emerge = {
  beats: [
    castOf([ROW, { form: 'fill', ids: ['a'], say: 'opens', dur: 0.9 }]),
    {
      block: 'stat',
      note: "any block: it plays on the object's colour as its tone",
    },
    {
      block: 'canvas',
      props: {
        cast: {
          formations: [
            { form: 'emerge', ids: ['a'], at: 0 },
            { ...ROW, at: 1 },
          ],
        },
      },
    },
  ],
};
