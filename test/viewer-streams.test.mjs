import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { createStaticServer } from '../packages/engine/dist/engine/lib/viewer/static.mjs';

// Large enough that the socket applies backpressure long before the file is read.
const SIZE = 16 * 2 ** 20;
const openDescriptors = () => fs.readdirSync('/dev/fd').length;

async function serve(t) {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cf-viewer-streams-')),
  );
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const film = path.join(base, 'film.mp4');
  const bytes = Buffer.alloc(SIZE);
  for (let i = 0; i < SIZE; i += 4) bytes.writeUInt32LE(i, i);
  fs.writeFileSync(film, bytes);
  const serveStatic = createStaticServer(base, path.join(base, 'out'), () =>
    path.join(base, 'out/index.html'),
  );
  const server = http.createServer((req, res) =>
    serveStatic(req, res, new URL(req.url ?? '/', 'http://localhost')),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  return { port, bytes };
}

/** Reads a little of the response, then drops the connection as a scrubbing player does. */
function abortAfterFirstBytes(port, headers = {}) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/film.mp4', headers },
      (res) => {
        let read = 0;
        res.on('data', (chunk) => {
          read += chunk.length;
          if (read > 128 * 1024) req.destroy();
        });
        res.on('close', () => resolve(res.statusCode));
      },
    );
    req.on('error', () => resolve(null));
  });
}

function fetchWhole(port, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: '/film.mp4', headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ res, body: Buffer.concat(chunks) }));
      })
      .on('error', reject);
  });
}

test('aborted full and ranged film responses close their source files', async (t) => {
  const { port } = await serve(t);
  const sources = [];
  const original = fs.createReadStream;
  t.mock.method(fs, 'createReadStream', (...args) => {
    const stream = original(...args);
    sources.push(stream);
    return stream;
  });
  const before = openDescriptors();
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    statuses.push(await abortAfterFirstBytes(port));
    statuses.push(await abortAfterFirstBytes(port, { range: 'bytes=4096-' }));
  }
  assert.deepEqual(new Set(statuses), new Set([200, 206]));
  assert.equal(sources.length, 24, 'every request opened its own source');
  // Bounded settle: each source must close, not merely be unpiped and left paused.
  for (let tries = 0; tries < 100 && sources.some((s) => !s.closed); tries++)
    await wait(20);
  const open = sources.filter((s) => !s.closed).length;
  assert.equal(open, 0, `${open} of ${sources.length} aborted reads left open`);
  // Corroboration from the process itself: descriptors return to where they were.
  assert.ok(
    openDescriptors() <= before + 2,
    `descriptors grew from ${before} to ${openDescriptors()}`,
  );
});

test('completed film responses keep their bytes and range headers', async (t) => {
  const { port, bytes } = await serve(t);
  const whole = await fetchWhole(port);
  assert.equal(whole.res.statusCode, 200);
  assert.equal(whole.res.headers['content-length'], String(SIZE));
  assert.equal(whole.res.headers['accept-ranges'], 'bytes');
  assert.ok(whole.body.equals(bytes), 'the whole file arrives unchanged');

  const part = await fetchWhole(port, { range: 'bytes=1000-1999' });
  assert.equal(part.res.statusCode, 206);
  assert.equal(part.res.headers['content-range'], `bytes 1000-1999/${SIZE}`);
  assert.equal(part.res.headers['content-length'], '1000');
  assert.ok(part.body.equals(bytes.subarray(1000, 2000)));

  const tail = await fetchWhole(port, { range: 'bytes=-16' });
  assert.equal(tail.res.statusCode, 206);
  assert.ok(tail.body.equals(bytes.subarray(SIZE - 16)));

  const beyond = await fetchWhole(port, { range: `bytes=${SIZE}-` });
  assert.equal(beyond.res.statusCode, 416);
  assert.equal(beyond.res.headers['content-range'], `bytes */${SIZE}`);
});
