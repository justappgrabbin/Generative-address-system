import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Substrate } from '../native/substrate.mjs';
import { readPGM } from '../native/files.mjs';
import { save, restore } from '../native/storage.mjs';

test('local format input, atomic state files, and in-process terminal work without network', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'substrate-'));
  try {
    const source = await readPGM(new URL('../native/fixtures/glyph.pgm', import.meta.url));
    assert.equal(source.samples.length, 16); assert.equal(source.samples[1], 1);
    await writeFile(join(directory, 'bad.pgm'), 'P2 2 2 255 0 0');
    await assert.rejects(readPGM(join(directory, 'bad.pgm')), /sample count/);
    const s = new Substrate(); s.add({ id: 'persistent', rank: 0, input: true }); s.evaluate({ persistent: 0.3 });
    await save(join(directory, 'state.json'), s);
    assert.deepEqual((await restore(join(directory, 'state.json'))).snapshot(), s.snapshot());
    const process = spawnSync(globalThis.process.execPath, ['native/main.mjs', 'inspect', directory], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
      input: '{"operation":"inspect","data":{"id":"persistent"}}\n{"operation":"quit"}\n'
    });
    if (process.error?.code === 'EPERM') { t.diagnostic('Child-process terminal check unavailable under sandbox; file decoding and persistence were verified. Run terminal check directly.'); return; }
    if (process.error) throw process.error;
    assert.equal(process.status, 0, process.stderr);
    assert.match(process.stdout, /"value":0.3/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
