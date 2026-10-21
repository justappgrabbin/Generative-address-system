# Synthia translation layer (additive, v0.1.0)

A pure-JS **fallback** runtime for Python, Ruby, Lua and C sources. It plugs into the existing runtime
slot (`RuntimeAdapterRegistry` → `UniversalExecutionBridge.execute()` "registered-runtime" step), so it
follows the flow you already have: read the source → put it together from its parts (tokenize → parse →
named rules) → run it. Results keep the address context and stage records.

## The slot stays open
* With no other backend present, the layer runs everything itself, offline.
* Other backends (any adapter with the same contract) can be passed as `backends`, and they are tried first.
  You can also register them ahead of the layer in the registry.
* If a backend throws or returns `ok:false`, the layer runs the source itself and records the
  `fallbackChain`.

```js
import { UniversalExecutionBridge } from '../../authorities/execution-spine/src/pure-synthia/integration/universal-execution-bridge.js';
import { registerTranslationLayer } from './src/index.mjs';
const bridge = new UniversalExecutionBridge();
registerTranslationLayer(bridge /*, { backends: [otherAdapter] } */);
const r = await bridge.execute({ name: 't.py', content: 'print(1+1)' }, { canonicalAddress: { gate: 41 } });
// r.path === 'registered-runtime'; r.result.stdout -> ['2']; r.result.rulesUsed, r.result.stages, r.result.address
```

## Sovereign
None of these: network, CDN, telemetry, WASM, web workers, GPU, native modules, dynamic import, or
Node-only APIs on the runtime path. Only relative imports are used. `open()`, `input()`, `system()`,
`rand()`, `os`, `hashlib` and similar host escapes are refused inside the sandbox. SHA-256 is computed
in pure JS, so the code runs the same on Node, in a browser, and in an Android WebView.
`tests/sovereignty.test.mjs` checks the source for these references. It also runs all four languages
with `fetch`/`XMLHttpRequest`/`WebSocket`/`EventSource`/`Worker`/`WebAssembly` blocked and with
`process`/`Buffer` removed.

## What each engine covers
* **Python**: modules, classes with inheritance and MRO, `@dataclass(frozen=True)`, `Enum`/`auto`,
  `staticmethod`/`classmethod`/`property`, `ABC`/`abstractmethod`, imports, comprehensions, f-strings and
  format specs, exceptions, closures, `*args`/`**kwargs`, and slicing. It ships shims for
  `math, json, typing, enum, dataclasses, abc, functools, collections, itertools, random, sys`, and a 1-D
  `numpy` subset: zeros/linspace/sin/log2/abs/sum/dot/correlate/linalg.norm, plus `random.RandomState`
  (MT19937). `sum` uses numpy's pairwise summation.
* **Ruby**: def/class/module, attr_*, ivars, blocks (`{}` and `do`), procs/lambdas, ranges, hashes,
  string interpolation, statement modifiers, case/when, begin/rescue, and the common Array/Hash/String/Integer methods.
* **Lua 5.4**: locals, closures, varargs, numeric and generic `for`, tables, metatables/`__index`, the
  `:` method syntax, the int/float distinction, and string/table/math libraries (patterns are mapped to JS RegExp).
* **C**: int/long/char/double (with int wraparound), arrays (multi-dimensional), structs, pointers and
  `&`/`*`/`->`, functions/recursion, all control flow including switch, `#define` constants, and a
  printf/sprintf/strlen/strcmp/strcpy/math subset. Out-of-bounds access and NULL dereference are reported
  as errors.

These are emulators (tree-walking interpreters written in JS). They do not ship a CPython, Ruby, Lua or
C toolchain. Anything outside the subsets above gives a reported error (`ok:false`, `stderr`) and is
never silently skipped.

## Verified results (`npm test` in this folder: 13/13)
* `fixtures/t.py`, `t.rb`, `t.lua`, `t.c` print exactly `*.expected`. `t.c.expected` is real gcc output.
* The donor `../generative-address-morphology/vendor/address_space_engine.py` (unmodified) plus
  `fixtures/address_space_engine_driver.py` run end-to-end. Text and structure match the recorded
  CPython 3.13.5 + numpy 2.5.4 output exactly. Floats agree to ≤1.6e-16 relative (last-ulp
  differences from BLAS summation order). That output is a stored fixture only; Python is never called.

## Note: execution-spine DAG scheduler
This layer leaves the DAG scheduler alone. When a large source goes through the Foundation/pipeline
ingestion path, every 6-bit chunk becomes a DAG node. `executeDAG` then scales roughly O(n²): about 37k
nodes for the 28 KB donor, which is an estimated hour of runtime. The layer avoids that path because it
reads the source directly. A fix would belong in the scheduler (indexed ready-queue instead of
rescanning), and it hasn't been made.
