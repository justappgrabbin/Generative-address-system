import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runSource } from '../src/index.mjs';
import { FIX, read } from './helpers.mjs';

for (const [file, lang] of [['t.py', 'python'], ['t.rb', 'ruby'], ['t.lua', 'lua'], ['t.c', 'c']]) {
  test(`${file} prints the expected output through the pure-JS ${lang} engine`, () => {
    const r = runSource(lang, read(path.join(FIX, file)));
    assert.equal(r.ok, true, r.stderr.join('\n'));
    assert.equal(r.stdout.join('\n') + '\n', read(path.join(FIX, `${file}.expected`)));
    assert.match(r.address.sourceSha256, /^[0-9a-f]{64}$/);
    assert.ok(r.rulesUsed.length > 0);
  });
}

test('errors are reported, not thrown', () => {
  const r = runSource('python', 'x = 1\nprint(y)\n');
  assert.equal(r.ok, false); assert.equal(r.error.type, 'NameError');
  const c = runSource('c', 'int main(void){ int a[2]; return a[5]; }');
  assert.equal(c.ok, false); assert.match(c.stderr[0], /out-of-bounds/);
});

test('host escapes are refused inside the sandbox', () => {
  assert.equal(runSource('python', "open('/etc/passwd')").error.type, 'OSError');
  assert.equal(runSource('python', 'import os').error.type, 'ModuleNotFoundError');
  assert.equal(runSource('c', 'int main(void){ system("ls"); return 0; }').ok, false);
});
