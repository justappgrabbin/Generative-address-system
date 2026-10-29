import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { G, HERE, jpegBytes, synthetic } from './helpers.mjs';
test('zlib deflate/inflate round-trip', () => { const d = new Uint8Array(50000).map((_, i) => (i * 7) % 251 ^ (i >> 9)); assert.deepEqual(G.inflate(G.deflate(d)), d); });
test('PNG encode -> decode is lossless (generated image)', () => { const im = synthetic(); const back = G.decodePng(G.encodePng(im)); assert.equal(back.width, 96); assert.deepEqual(back.data, im.data); });
test('decodes existing PNG fixture', () => { const im = G.decodePng(new Uint8Array(fs.readFileSync(path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'gradient.png')))); assert.ok(im.width > 0 && im.data.length === im.width * im.height * 4); });
test('baseline JPEG decode of the photo', () => { const im = G.decodeJpeg(jpegBytes()); assert.equal(im.width, 784); assert.equal(im.height, 1168); const mean = im.data.reduce((s, v, i) => (i % 4 === 3 ? s : s + v), 0) / (im.width * im.height * 3); assert.ok(mean > 10 && mean < 245); });

