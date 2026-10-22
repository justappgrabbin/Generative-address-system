# Browser Runtime Adapter Contract

Synthia's Browser executes artifacts through runtime adapters. Universal execution is compositional: the bridge does not claim that translation to JavaScript is native execution.

## Order

1. Detect artifact kind.
2. Ask registered runtime adapters whether they can execute the original artifact.
3. If one can, prepare and execute it, capturing stdout/stderr/return value/engine identity.
4. Only when no registered runtime can run it does the existing mesh/state-space synthesis path attempt a behavioral JS runtime reconstruction.
5. The caller can then use the actual execution observation for canonical addressing and persistence.

## Adapter shape

```js
{
  id: 'python-pyodide',
  kinds: ['python'],
  async canRun({artifact, kind, context}) {},
  async prepare({artifact, kind, context}) {},
  async execute({artifact, kind, context, prepared}) {
    return { ok:true, engine:'python-pyodide', stdout:[], stderr:[], returnValue:null };
  }
}
```

Adapters can represent bundled WASM runtimes (Python, Ruby, Lua, etc.), browser compilers/transpilers (TypeScript/JSX), emulators, project runners, or host-provided native runtimes in the packaged Android app.

## Donor roles from the supplied archives

- `execution-engine`: execution trace/graph capture donor.
- `dagengine`: dependency planning/orchestration donor.
- `execute-js`: nested/retry/concurrency workflow donor.
- `godot-quickjs`: deterministic JavaScript VM donor; not a Python runtime.
- `ExpoSE`: JavaScript symbolic-analysis donor; not a general execution runtime.
- `Online-Code-Execution-Engine`: browser JS/TS bundling/editor donor; not a native arbitrary-language runtime.

A raw ZIP is a container, not an executable language. A ZIP/project adapter should unpack to the VFS, inspect manifests/entry points, resolve the appropriate runtime adapter, then recursively execute the resolved entry artifact.
