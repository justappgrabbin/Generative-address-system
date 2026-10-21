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
