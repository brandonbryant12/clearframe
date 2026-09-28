import test from 'node:test';
import assert from 'node:assert/strict';
test('imageSize reads PNG and JPEG headers', async () => {
  const { imageSize } = await import('../engine/lib/browser.mjs');
  const png = Buffer.alloc(24); png[0] = 0x89; png[1] = 0x50; png.writeUInt32BE(1920, 16); png.writeUInt32BE(1080, 20);
  assert.deepEqual(imageSize(png), { width: 1920, height: 1080 });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x1c, 0x03, 0xc0, 0x03]);
  assert.deepEqual(imageSize(jpg), { width: 960, height: 540 });
});
