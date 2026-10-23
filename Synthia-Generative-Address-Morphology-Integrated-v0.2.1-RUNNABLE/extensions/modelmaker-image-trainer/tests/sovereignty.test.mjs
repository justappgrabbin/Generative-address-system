import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { SRC, JPG } from './helpers.mjs';
const NEURAL = path.join(import.meta.dirname, '..', 'vendor', 'modelmaker-morph-studio', 'dist', 'neural.mjs');
test('wrapper and her neural.mjs have no network/worker/wasm/node-only references', () => {
  const forbidden = [/from\s+['"]node:/, /require\s*\(/, /(?<![.\w])import\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bWorker\b/, /WebAssembly/, /navigator\.gpu/, /\bprocess\./, /\bBuffer\b/, /https?:\/\//];
  for (const f of [SRC, NEURAL]) { const t = fs.readFileSync(f, 'utf8'); for (const re of forbidden) assert.ok(!re.test(t), `${f} ${re}`); }
});
test('train, save, load, generate with network/Worker/WASM blocked and process/Buffer removed', () => {
  const probe = `const out=process.stdout.write.bind(process.stdout);const hits=[];const block=n=>function(){hits.push(n);throw new Error('blocked '+n)};
    for(const n of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker'])globalThis[n]=block(n);
    globalThis.WebAssembly=new Proxy({},{get(){hits.push('WebAssembly');throw new Error('wasm blocked')}});
    const fs=await import('node:fs');const bytes=new Uint8Array(fs.readFileSync(${JSON.stringify(JPG)}));
    const saved={process:globalThis.process,Buffer:globalThis.Buffer};globalThis.process=undefined;globalThis.Buffer=undefined;
    const T=await import(${JSON.stringify(SRC)});const img=T.decodeImageBytes(bytes);const s=Math.floor(Math.min(img.width,img.height)/2);
    const A=T.toField(img,8,{side:s}),B=T.toField(img,8,{x:img.width-s,side:s});
    const r=T.train([{source:A,target:B,address:{...T.DEFAULT_ADDRESS,gate:1}},{source:B,target:A,address:{...T.DEFAULT_ADDRESS,gate:2}}],{size:8,epochs:5});
    const st=new T.ModelStore();const rec=st.save('x',r.model);const g=T.generate(st.load(rec.address),A,8,{...T.DEFAULT_ADDRESS,gate:17});
    Object.assign(globalThis,saved);out(JSON.stringify({hits,ok:g.every(Number.isFinite)}));`;
  const p = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' }); assert.equal(p.status, 0, p.stderr);
  assert.deepEqual(JSON.parse(p.stdout), { hits: [], ok: true });
});
