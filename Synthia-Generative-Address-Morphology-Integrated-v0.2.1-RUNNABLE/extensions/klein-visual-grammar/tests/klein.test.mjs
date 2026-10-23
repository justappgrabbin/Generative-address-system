import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const HERE = import.meta.dirname, VEND = path.join(HERE, '..', 'vendor', 'kmge_v5_fixed');
const JPG = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
const bytes = new Uint8Array(fs.readFileSync(JPG)), img = G.downscale(G.decodeJpeg(bytes), 4);
const store = new G.GenerativeImageStore(), m = store.store('photo', img, { sourceBytes: bytes }), read = K.readImage(img, { an: store.load(m.address) });
test('vendored Klein tools are byte-exact to PROVENANCE.sha256', () => {
  for (const line of fs.readFileSync(path.join(HERE, '..', 'PROVENANCE.sha256'), 'utf8').trim().split('\n')) { const [sha, f] = line.split(/\s+/); assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(VEND, f))).digest('hex'), sha, f); }
});
test('primitives + regions + relations come from the image', () => {
  assert.equal(read.regions.length, 4); assert.equal(read.regions.reduce((s, r) => s + r.blocks, 0), read.an.bx * read.an.by);
  for (const p of ['adjacent', 'brighter_than']) assert.ok(read.relations.some((r) => r.predicate === p), p);
});
test('CompGramCoder accepts visual tokens but its fixed game lexicon codes them all MISC', () => { assert.equal(read.compGramCoder.allMisc, true); });
test('SensoryInputAdapter -> DiseMinerEngine ingests regions/relations; reachability computed', () => {
  for (const R of read.regions) assert.ok(read.diseminer.stems.includes(R.id));
  assert.ok(read.diseminer.links.length > 0); assert.ok(read.diseminer.reachable.R0.length > 0);
});
test('AutolingGrammar learns row grammar and can say a learned row', () => { assert.ok(read.autoling.rules > 0); assert.equal(read.autoling.firstRowParses, true); });
test('grammar-level recolor changes only that region class; other blocks byte-identical', () => {
  for (let c = 0; c < 4; c++) { const t = K.recolorClass(read, c), d = K.regionDiff(read, t.baseline, t.image, c); assert.equal(d.maxDiffOutside, 0); assert.ok(d.maxDiffInside > 0); }
  assert.ok(G.psnr(img, K.recolorClass(read, 3).baseline).psnr > 40);
});
