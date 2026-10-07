// One idea, two creative options: an order's journey from a tap to a doorstep, told with the same
// cast moves in two looks: `drawn` (pen on paper, on ink) and `pixel` (pixel art, on the lcd
// palette). The objects are composed cast shapes: phone, envelope, server, database, box, truck,
// flag. Positions are laid out per frame shape so landscape reads left to right and vertical top
// to bottom.
// usage: node examples/order-journey/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const LAYOUT = {
  landscape: { phone: [250, 600], server: [760, 520], database: [760, 860], truck: [1250, 640], flag: [1690, 600] },
  vertical: { phone: [290, 480], server: [770, 760], database: [300, 1060], truck: [740, 1330], flag: [330, 1620] },
};
const LOOKS = {
  drawn: { theme: 'ink', type: 'geometric', title: 'Order journey, drawn' },
  pixel: { theme: 'lcd', type: 'geometric', title: 'Order journey, pixel' },
};

for (const [look, style] of Object.entries(LOOKS))
  for (const shape of ['landscape', 'vertical']) {
    const L = LAYOUT[shape];
    const place = id => ({ form: 'cluster', ids: [id], center: L[id], at: 0 });
    const beats = [
      { id: 'order', vo: 'Someone taps Buy, and the order flies to the server.', tail: 0.4,
        cast: { look, objects: [
          { id: 'phone', shape: 'phone', color: 'accent', size: 270, enter: 'none', float: false },
          { id: 'server', shape: 'server', color: 'surface', size: 280, enter: 'none', float: false },
          { id: 'database', shape: 'database', color: 'accent2', size: 230, enter: 'none', float: false },
          { id: 'truck', shape: 'truck', color: 'accent', size: 320, enter: 'none', float: false },
          { id: 'flag', shape: 'flag', color: 'accent2', size: 260, enter: 'none', float: false },
          { id: 'order', shape: 'envelope', color: 'accent2', size: 190, float: false },
        ], formations: [...['phone', 'server', 'database', 'truck', 'flag'].map(place),
          { form: 'split', from: 'phone', ids: ['order'], say: 'Buy', spread: 0.6 }, { form: 'travel', ids: ['order'], to: 'server', say: 'flies', dur: 1.2 }] } },
      { id: 'stock', vo: 'It checks the stock.', tail: 0.6,
        cast: { formations: [{ form: 'wave', ids: ['server', 'database'], say: 'checks' }, { form: 'mark', mark: 'underline', ids: ['database'], say: 'stock' }] } },
      { id: 'pack', vo: 'The order becomes a parcel,', tail: 0.2,
        cast: { objects: [{ id: 'parcel', shape: 'box', color: 'accent2', size: 200, float: false }],
          formations: [{ form: 'swap', out: 'order', in: 'parcel', by: ['server'], say: 'parcel', dur: 0.6 }] } },
      { id: 'ship', vo: 'rides the truck to the door,', tail: 0.2,
        cast: { formations: [{ form: 'merge', ids: ['parcel'], into: 'truck', say: 'rides', dur: 0.8 }, { form: 'travel', ids: ['truck'], to: 'flag', say: 'door', dur: 1.4 }] } },
      { id: 'done', vo: 'and arrives.', hold: 1.4,
        cast: { formations: [{ form: 'wave', ids: ['flag'], say: 'arrives' }] } },
    ];
    const storyboard = {
      version: 2,
      title: style.title,
      logline: 'An order travels from a tap to a doorstep: the same cast moves, in a look chosen for the audience.',
      format: { preset: shape, fps: 30 },
      theme: style.theme, type: style.type, motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none', lens: { handheld: 0 },
      captions: false, music: false,
      beats: beats.map(({ id, vo, cast, tail, hold }) => ({ id, block: 'canvas', vo, ...(tail != null ? { tail } : {}), ...(hold ? { hold } : {}), props: { cast } })),
    };
    fs.writeFileSync(new URL(`storyboard-${look}-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
  }
console.log('wrote storyboard-{drawn,pixel}-{landscape,vertical}.json');
