// Writes source / target / generated-at-unseen-address PNGs + metrics. Usage: node scripts/make-samples.mjs [outDir]
import fs from 'node:fs'; import path from 'node:path';
import * as H from '../tests/helpers.mjs'; const { T } = H; const SIZE = 32;
const out = process.argv[2] ?? '/workspace/genrec-samples/modelmaker'; fs.mkdirSync(out, { recursive: true });

const img = T.decodeImageBytes(new Uint8Array(fs.readFileSync(H.JPG))), side = Math.floor(Math.min(img.width, img.height) / 2);
const at = (fx, fy) => T.toField(img, SIZE, { x: Math.floor((img.width - side) * fx), y: Math.floor((img.height - side) * fy), side });
const A = at(0, 0), B = at(1, 0), C = at(0, 1), D = at(1, 1), adr = (g) => ({ ...T.DEFAULT_ADDRESS, gate: g });
const P = [{ name: 'A->B@1', source: A, target: B, address: adr(1) }, { name: 'A->C@33', source: A, target: C, address: adr(33) }, { name: 'A->D@64', source: A, target: D, address: adr(64) }, { name: 'B->D@33', source: B, target: D, address: adr(33) }];
const t0 = Date.now(), r = T.train(P, { size: SIZE, epochs: 150 }), ms = Date.now() - t0;
const st = new T.ModelStore(), rec = st.save('photo-crops', r.model);
const w = (n, f) => fs.writeFileSync(path.join(out, n), T.fieldToPng(f, SIZE));
w('source-A.png', A); w('target-B-gate1.png', B); w('target-C-gate33.png', C); w('target-D-gate64.png', D);
const gens = {}; for (const g of [1, 33, 64, 17]) { const f = T.generate(r.model, A, SIZE, adr(g)); gens[g] = f; w(`generated-gate${g}${[1, 33, 64].includes(g) ? '-seen' : '-UNSEEN'}.png`, f); }
const metrics = { size: SIZE, trainMs: ms, baseline: r.baseline, final: r.final, modelAddress: rec.address, unseenGate17_mseVsTargets: { B: T.mse(gens[17], B), C: T.mse(gens[17], C), D: T.mse(gens[17], D) }, seenGate1_mseVsB: T.mse(gens[1], B), addressFieldMeanings: 'investigating' };
fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 1)); console.log(JSON.stringify(metrics, null, 1));
