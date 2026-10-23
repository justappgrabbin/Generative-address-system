import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const b = K.bits, s = K.str, HERE = import.meta.dirname;
test('ATO properties: *ab=*ba, *a(*ab)=b, *b(*ab)=a; truth table', () => {
  assert.equal(s(K.ato(b('0011'), b('0101'))), '1001');
  const a = b('1101001011'), c = b('0111010010'), ab = K.ato(a, c);
  assert.deepEqual(K.ato(c, a), ab); assert.deepEqual(K.ato(a, ab), c); assert.deepEqual(K.ato(c, ab), a);
  assert.equal(s(K.ato(b('1-0'), b('110'))), '1-1');
});
test("paper's worked examples", () => {
  assert.equal(s(K.analogy(b('10101010'), b('01010110'), b('01100101'))), '10011001');
  assert.equal(s(K.analogy(b('10010101'), b('01011010'), b('10100110'))), '01101001');
});
test('complex analogy, ATO tree, replan identities', () => {
  const [X, Y, Z, W, P] = ['1100', '1010', '0110', '0011', '1001'].map(b);
  assert.deepEqual(K.complexAnalogy(X, Y, Z, W, P), K.ato(P, K.ato(K.ato(X, Y), K.ato(Z, W))));
  const t = K.atoTree([X, Y, Z, W], 2); assert.equal(t[1].length, 3); assert.equal(t[2].length, 2);
  const [D, E] = [b('1110'), b('0001')], re = K.replan([X, Y, Z, D], D, E); assert.deepEqual(re[3], E);
  assert.deepEqual(K.ato(re[0], re[1]), K.ato(X, Y)); // ATOs unchanged
});
test("matches Alexis's vendored klein-iching-ato-mesh.ts ato() (byte-exact file)", () => {
  const f = path.join(HERE, '..', 'vendor', 'klein-final-engines', 'klein-iching-ato-mesh.ts'), txt = fs.readFileSync(f, 'utf8');
  assert.equal(crypto.createHash('sha256').update(txt).digest('hex'), fs.readFileSync(path.join(HERE, '..', 'PROVENANCE-ato.sha256'), 'utf8').split(/\s/)[0]);
  const body = txt.match(/export function ato\(a: number, b: number, bits: number = 6\): number \{([\s\S]*?)\n\}/)[1].replace(/const mask/, 'const mask');
  const herAto = new Function('a', 'b', 'bits', body);
  for (let a = 0; a < 64; a++) for (let c = 0; c < 64; c++) assert.equal(herAto(a, c, 6).toString(2).padStart(6, '0'), s(K.ato(b(a.toString(2).padStart(6, '0')), b(c.toString(2).padStart(6, '0')))));
});
test('visual analogy R0:R1::R2:? renders onto R2 only', () => {
  const p = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((x) => fs.existsSync(x));
  const r = K.readImage(G.downscale(G.decodeJpeg(new Uint8Array(fs.readFileSync(p))), 4)), v = K.visualAnalogy(r, 0, 1, 2);
  assert.deepEqual(v.result, K.ato(v.C, K.ato(v.A, v.B))); const d = K.regionDiff(r, v.baseline, v.image, 2); assert.equal(d.maxDiffOutside, 0); assert.ok(d.maxDiffInside > 0);
});
