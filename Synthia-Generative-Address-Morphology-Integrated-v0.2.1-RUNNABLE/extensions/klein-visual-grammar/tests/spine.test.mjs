import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const HERE = import.meta.dirname, p = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((x) => fs.existsSync(x));
const read = K.readImage(G.downscale(G.decodeJpeg(new Uint8Array(fs.readFileSync(p))), 4));
test('real gate table is byte-exact and agrees with the spine (binary + trigrams) and loads into spine StateSpace', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'data', 'real_gate_table.json'))).digest('hex');
  assert.equal(sha, '05532cf0448e84f3898318cfc8fa3835e9ab05bc21bfd5d1b7c3b4ba71da146d');
  assert.deepEqual(K.gateTableCheck(), { gates: 64, binaryMatchesSpine: 64, trigramsMatchSpineBuilt: 64 }); assert.ok(K.spineStateSpace());
});
test('tools come from the spine registry; learnings stored in spine memory at a GATE_WHEEL address (no hash)', () => {
  const o = K.learnOnSpine(read); assert.equal(o.tools.autoling.id, 'autoling'); assert.ok(o.rules >= 1);
  assert.match(o.at.gateSource, /longitudeToHD/); assert.equal(o.at.gateTableEntry.gate, o.at.address.gate);
  for (const pr of o.memory.snapshot().precedents) assert.equal(pr.address.gate, o.at.address.gate);
});
test('game words: placed only via spine lexicon, no word gate invented; rest held with reason', () => {
  const o = K.learnOnSpine(read), g = K.placeGameWordsOnSpine(o.memory, o.tools);
  assert.equal(g.placed.length + g.held.length, 56);
  for (const r of g.placed) { assert.equal(r.wordGate, null); assert.ok(r.spinePos); assert.match(r.justification.lexicon, /SEED_WORDS/); }
  for (const h of g.held) assert.ok(h.reason.length > 10);
});
