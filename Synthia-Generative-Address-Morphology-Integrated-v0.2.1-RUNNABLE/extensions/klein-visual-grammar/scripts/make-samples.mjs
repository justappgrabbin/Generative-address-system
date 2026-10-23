// Node-only demo: reads the photo through her Klein tools via genrec layers, writes learned JSON + before/after PNGs.
import fs from 'node:fs'; import path from 'node:path';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const outDir = process.argv[2] || path.join(import.meta.dirname, '..', 'fixtures', 'out'); fs.mkdirSync(outDir, { recursive: true });
const SRC = '/workspace/v05/n4/uc/grok_1786623505617.jpg';
const bytes = new Uint8Array(fs.readFileSync(fs.existsSync(SRC) ? SRC : path.join(import.meta.dirname, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')));
const img = G.downscale(G.decodeJpeg(bytes), 4), store = new G.GenerativeImageStore(), m = store.store('photo', img, { sourceBytes: bytes });
const read = K.readImage(img, { an: store.load(m.address) });
const cls = Number(process.argv[3] ?? 3), t = K.recolorClass(read, cls);
const save = (n, im) => fs.writeFileSync(path.join(outDir, n), G.encodePng(im));
save('before.png', t.baseline); save(`after-recolor-R${cls}.png`, t.image);
const mask = { width: img.width, height: img.height, data: new Uint8Array(img.data.length) }; const pal = [[40, 40, 40], [200, 60, 60], [60, 160, 60], [80, 120, 230]];
for (let i = 0; i < img.width * img.height; i++) { const b = ((((i / img.width) | 0) >> 3) * read.an.bx) + ((i % img.width) >> 3); mask.data.set([...pal[read.lab[b] % 4], 255], i * 4); } save('regions.png', mask);
const report = { source: m.address, layersUsed: store.load(m.address).used, transform: t.rule, changedBlocks: t.changedBlocks, diff: K.regionDiff(read, t.baseline, t.image, cls), learned: K.learnedStructure(read) };
fs.writeFileSync(path.join(outDir, 'learned-structure.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, learned: undefined }, null, 1));
// ATO (Klein et al. ~1981): paper examples, visual analogy R0:R1::R2:?, patterns behind patterns over moving-photo frames.
const s = K.str, b = K.bits, va = K.visualAnalogy(read, 0, 1, 2);
save('after-ato-analogy-R0R1-R2.png', va.image);
const ato = { paperExample1: { X: '10101010', Y: '01010110', Z: '01100101', XY: s(K.ato(b('10101010'), b('01010110'))), answer: s(K.analogy(b('10101010'), b('01010110'), b('01100101'))), paperSays: '10011001' },
  paperExample2: { X: '10010101', Y: '01011010', Z: '10100110', answer: s(K.analogy(b('10010101'), b('01011010'), b('10100110'))), paperSays: '01101001' },
  visualAnalogy: { A_R0: s(va.A), B_R1: s(va.B), C_R2: s(va.C), result: s(va.result), decoded: va.decoded, diff: K.regionDiff(read, va.baseline, va.image, 2), bitLayout: 'Y(3) Cb>0 Cr>0 texture(2) verticalEdge' } };
const FR = '/workspace/genrec-samples/moving-photo';
if (fs.existsSync(FR)) {
  const frames = fs.readdirSync(FR).filter((f) => /^frame-\d+\.png$/.test(f)).sort().map((f) => G.decodePng(new Uint8Array(fs.readFileSync(path.join(FR, f)))));
  const states = frames.map((f) => { const an = G.analyze(f), out = []; for (let i = 0; i < an.bx * an.by; i++) out.push(an.coefs[0][i * 64] / 8 + 128 > 128 ? 1 : 0); return out; }); // 2D bright/dark bit-plane per frame
  const tree = K.atoTree(states, 2), ones = (a) => +(a.filter((x) => x === 1).length / a.length).toFixed(4);
  ato.patternsBehindPatterns = { frames: frames.length, blocksPerFrame: states[0].length, level0_onesFraction: tree[0].map(ones), level1_ATO_onesFraction: tree[1].map(ones), level2_ATOofATO_onesFraction: tree[2].map(ones), note: '1.0 = identical (no change); level 2 shows whether the change itself is constant' };
}
fs.writeFileSync(path.join(outDir, 'ato-report.json'), JSON.stringify(ato, null, 2)); console.log(JSON.stringify(ato));
