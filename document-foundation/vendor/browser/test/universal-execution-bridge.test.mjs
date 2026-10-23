import assert from 'node:assert/strict';
import {
  UniversalExecutionBridge,
  deriveExecutionRequirements,
} from '../src/integration/universal-execution-bridge.js';

const bridge = new UniversalExecutionBridge({ seed: 18091999 });

// Non-JS, no direct handler, imports + mutable state + list + loop + branch + math + builtins.
const py = {
  name: 'foreign-runtime.py',
  content: [
    'import math',
    'values = []',
    'total = 0',
    'for i in range(1, 11):',
    '    value = math.floor(math.sqrt(i * i))',
    '    if value % 2 == 0:',
    '        values.append(value)',
    '        total += value',
    'print("NONJS_SYNTH_OK", len(values), total)',
    '',
  ].join('\n'),
};

const req = deriveExecutionRequirements(py, { error: 'NO_DIRECT_EXECUTOR:python' });
for (const r of ['output','variables','arithmetic','branch','loop','collections','range','builtins','math-module','imports']) {
  assert.ok(req.required.includes(r), `requirement ${r} derived`);
}

const first = await bridge.execute(py);
assert.equal(first.ok, true);
assert.equal(first.path, 'state-space-runtime-synthesis');
assert.deepEqual(first.result.stdout, ['NONJS_SYNTH_OK 5 30']);
assert.ok(first.synthesis.selectedRules.includes('py-math-contact'));
assert.ok(first.synthesis.selectedRules.includes('py-control-loop'));
assert.ok(first.synthesis.learnedRule);
assert.ok(first.plan.monteCarloDominant);

const second = await bridge.execute(py);
assert.equal(second.ok, true);
assert.equal(second.path, 'learned-synthesized-runtime');
assert.equal(second.reused, true);
assert.deepEqual(second.result.stdout, ['NONJS_SYNTH_OK 5 30']);

// Computationally heavy foreign execution: one million iterations, actual loop work.
const heavy = {
  name: 'heavy-foreign.py',
  content: [
    'import math',
    'total = 0',
    'for i in range(1, 1000001):',
    '    value = math.floor(math.sqrt(i * i))',
    '    if value % 2 == 0:',
    '        total += value',
    'print("HEAVY_FOREIGN_OK", total)',
    '',
  ].join('\n'),
};
const t = Date.now();
const h = await bridge.execute(heavy);
assert.equal(h.ok, true);
assert.equal(h.path, 'state-space-runtime-synthesis');
assert.deepEqual(h.result.stdout, ['HEAVY_FOREIGN_OK 250000500000']);
console.log(`universal-execution-bridge: PASS (foreign synthesis + 1,000,000-loop workload in ${Date.now()-t} ms)`);
