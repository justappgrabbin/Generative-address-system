import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const HERE = import.meta.dirname, p = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((x) => fs.existsSync(x));
const read = K.readImage(G.downscale(G.decodeJpeg(new Uint8Array(fs.readFileSync(p))), 4));
test('Monte Carlo (her tool-06 + mulberry32) is deterministic and lowers seam error vs deterministic ATO', () => {
  const a = K.monteCarloAnalogy(read, 0, 1, 2), b = K.monteCarloAnalogy(read, 0, 1, 2);
  assert.equal(a.monteCarlo.state, b.monteCarlo.state); assert.ok(a.accepted); assert.ok(a.monteCarlo.score <= a.deterministic.score); assert.ok(a.monteCarlo.seam < a.deterministic.seam);
});
test('tools resolve through her KleinModuleRegistry; learnings live on LearningMesh; CompGramCoder MISC drops via mesh words', async () => {
  const o = await K.learnOnMesh(read); assert.equal(o.tools.autoling.complete, true);
  assert.ok(K.meshWords(o.mesh).length > 0); const cg = K.meshCompGramCoder(o.mesh), d = [...new Set(read.tokens)], misc = (f) => d.filter((t) => f(t).codes[0] === 'MISC').length;
  assert.ok(misc((t) => cg.classify(t)) < misc((t) => cg.base.classify(t)));
});
test('every placed game rule has a justification traceable to her mesh logic; no gate guessed; rest held with reason', async () => {
  const o = await K.learnOnMesh(read), src = fs.readFileSync(path.join(HERE, '..', '..', '..', 'vendor', 'cynthia-original', 'r21.21', K.LEARNER_PATH), 'utf8');
  for (const r of o.gaming.placed) { assert.equal(r.justification.source, 'r21.21/' + K.LEARNER_PATH); assert.ok(r.justification.matchedRoles.length > 0); assert.equal(r.gate, null);
    for (const role of r.justification.matchedRoles) assert.ok(src.includes(`roles.push('${role}')`)); assert.ok(src.includes(`'${r.dimension}'`)); }
  for (const h of o.gaming.held) assert.ok(h.reason.length > 10);
  assert.equal(o.gaming.placed.length + o.gaming.held.length, 48 + 8);
});
