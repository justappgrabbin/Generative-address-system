import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const HERE = import.meta.dirname, SRC = path.join(HERE, '..', 'src'), VD = path.join(HERE, '..', 'vendor', 'kmge_v5_fixed', 'dist');
test('adapter source has no network/worker/wasm/gpu/node-only refs', () => {
  const bad = [/from\s+['"]node:/, /require\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bWorker\b/, /WebAssembly/, /navigator\.gpu/, /\bprocess\./, /\bBuffer\b/, /https?:\/\//];
  for (const f of fs.readdirSync(SRC)) { const t = fs.readFileSync(path.join(SRC, f), 'utf8'); for (const re of bad) assert.ok(!re.test(t), `${f} ${re}`); }
});
test('the two vendored Klein modules used have no network/worker/wasm refs (they are CommonJS: only relative require)', () => {
  for (const f of ['klein-mesh-game-engine.js', 'sensory-adapter.js']) { const t = fs.readFileSync(path.join(VD, f), 'utf8'); for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bWorker\b/, /WebAssembly/, /https?:\/\//]) assert.ok(!re.test(t), `${f} ${re}`); for (const m of t.matchAll(/require\(["']([^"']+)["']\)/g)) assert.ok(m[1].startsWith('./'), m[1]); }
});
test('read + transform runs with network/workers/wasm blocked', () => {
  const probe = `const hits=[]; for (const n of ['fetch','XMLHttpRequest','WebSocket','Worker']) globalThis[n]=function(){hits.push(n);throw new Error(n)};
    globalThis.WebAssembly=new Proxy({},{get(){hits.push('wasm');throw new Error('wasm')}});
    const G=await import(${JSON.stringify(path.join(HERE, '..', '..', 'generative-reconstruction', 'src', 'index.mjs'))}); const K=await import(${JSON.stringify(path.join(SRC, 'index.mjs'))});
    const d=new Uint8Array(64*48*4); for(let i=0;i<64*48;i++){d[i*4]=(i%64)*4;d[i*4+1]=((i/64)|0)*5;d[i*4+2]=i%7*30;d[i*4+3]=255}
    const img={width:64,height:48,data:d}; const r=K.readImage(img); const t=K.recolorClass(r,1);
    process.stdout.write(JSON.stringify({hits, out:K.regionDiff(r,t.baseline,t.image,1).maxDiffOutside}));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout); assert.deepEqual(o.hits, []); assert.equal(o.out, 0);
});
