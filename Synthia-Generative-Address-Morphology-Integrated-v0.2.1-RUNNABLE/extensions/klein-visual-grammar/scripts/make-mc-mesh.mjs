// Node-only demo: Monte Carlo over the ATO analogy + AUTOLING learning on the mesh. Writes to <out>/mc/.
import fs from 'node:fs'; import path from 'node:path';
import * as G from '../../generative-reconstruction/src/index.mjs';
import * as K from '../src/index.mjs';
const outDir = path.join(process.argv[2] || path.join(import.meta.dirname, '..', 'fixtures', 'out'), 'mc'); fs.mkdirSync(outDir, { recursive: true });
const SRC = '/workspace/v05/n4/uc/grok_1786623505617.jpg';
const bytes = new Uint8Array(fs.readFileSync(fs.existsSync(SRC) ? SRC : path.join(import.meta.dirname, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')));
const img = G.downscale(G.decodeJpeg(bytes), 4), store = new G.GenerativeImageStore(), m = store.store('photo', img, { sourceBytes: bytes }), read = K.readImage(img, { an: store.load(m.address) });
const mc = K.monteCarloAnalogy(read, 0, 1, 2), save = (n, im) => fs.writeFileSync(path.join(outDir, n), G.encodePng(im));
save('before.png', mc.baseline); save('ato-deterministic.png', mc.deterministic.image); save('ato-montecarlo.png', mc.monteCarlo.image);
const o = await K.learnOnMesh(read, { ato: { analogy: 'R0:R1::R2:?', deterministic: mc.deterministic.state, monteCarlo: mc.monteCarlo.state } });
const distinct = [...new Set(read.tokens)], cg = K.meshCompGramCoder(o.mesh), misc = (f) => distinct.filter((t) => f(t).codes[0] === 'MISC').length;
const rep = { monteCarlo: { candidates: mc.candidates, originalSeam: K.seamError(read, mc.baseline, 2), deterministic: { ...mc.deterministic, image: undefined }, monteCarlo: { ...mc.monteCarlo, image: undefined } },
  mesh: { before: o.before, after: o.after, gamePlaced: o.gaming.placed, gameHeld: o.gaming.held, visualWords: K.meshWords(o.mesh), h2Rules: o.h2Rules, learnedGrammarNodes: o.grammarNodes,
    compGramCoderMISC: { before: misc((t) => cg.base.classify(t)), after: misc((t) => cg.classify(t)), distinct: distinct.length }, comparison: K.compareToGameMeaning(o.mesh, 'R3.rough.eh'), registry: { autolingComplete: o.tools.autoling.complete, learner: o.tools.learner } } };
fs.writeFileSync(path.join(outDir, 'mc-mesh-report.json'), JSON.stringify(rep, null, 2)); console.log(JSON.stringify(rep.monteCarlo), JSON.stringify(rep.mesh.compGramCoderMISC));
