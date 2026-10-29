# Local computational substrate

Requires Node.js 22+; no dependencies to install. Runs offline after the runtime is available.

```sh
npm start
```

The terminal accepts one JSON command per line and inspects the same in-process state that executes them. An empty state is created on first launch; an existing saved state is restored on subsequent launches. `SWARM_DATA` selects the data directory, default `./swarm-data`.

New empty states use encounter discovery and derive execution order from active connections. They do not require ranks or manual offers. Restored states retain their original experimental policies. The commands below remain available for explicitly scaffolded experiments; manual wiring is not evidence of encounter emergence.

```json
{"operation":"add","data":{"id":"input","rank":0,"input":true}}
{"operation":"add","data":{"id":"output","rank":1}}
{"operation":"offer","data":{"from":"input","to":"output"}}
{"operation":"evaluate","data":{"input":0.8}}
{"operation":"feedback","data":{"output":0.4}}
{"operation":"inspect"}
{"operation":"trace"}
{"operation":"save"}
{"operation":"quit"}
```

This example exposes primitive operations; it does not by itself train a generalized capability. Run the controlled experiments for held-out evidence:

```sh
npm run experiment -- ./swarm-data
npm run experiment:encounters -- ./swarm-data
npm run experiment:adaptation -- ./swarm-data
npm run experiment:memory -- ./swarm-data
npm test
```

Outputs: `report.json`, `functional-state.json`, `image-state.json`, and `reconstructed.svg`. The SVG displays surface constituents, not a substituted input image. The current observable interface is terminal inspection plus an output artifact, not the planned continuous micro/meso graphical inspector.

The experiment decodes the local `native/fixtures/glyph.pgm` file. The initial decoder supports ASCII PGM; the experiment currently accepts only 4×4 grayscale images. To inspect the saved image graph directly:

```sh
node native/main.mjs inspect ./swarm-data image-state.json
```

The encounter experiment separately writes `encounter-report.json` and `encounter-state.json`. It starts without manually offered connections or supplied execution ranks. Local movement enables repeated encounters; feedback develops executable edges. Disabled encounters, separated contacts, and an unmet encounter threshold serve as controls. Inspect the resulting live state with:

```sh
node native/main.mjs inspect ./swarm-data encounter-state.json
```

This is an experimental adaptive linear DAG. It does not yet demonstrate spontaneously developed hidden neurons, recurrent neural dynamics, or functional meshes.

The adaptation experiment writes `adaptation-state.json` and `adaptation-report.json`. It changes an external spatial condition and the feedback examples, without manually rewiring the formation. A weak obsolete connection is retired with its history retained, a new encountered connection develops, and held-out execution, disruption, restoration and restart are scored. Controls independently withhold feedback or the new encounter.

```sh
node native/main.mjs inspect ./swarm-data adaptation-state.json
```

Use `{"operation":"history","data":{"id":"a"}}` to inspect constituent `a`'s relation/perturbation events and retired connections. `place` is an explicit external spatial perturbation primitive, not a learned capability or hidden topology command. New empty inspector states enable experimental weak-contribution pruning; restored states retain their saved policy.

The memory experiment uses a separate, explicitly experimental delayed-execution policy. It writes `memory-state.json` and `memory-report.json`. A learned recurrent weight retains state across interactions. Held-out sequence, recurrence disruption, restoration, restart, differing histories with the same present input, and a no-self-observation control are measured.

```sh
node native/main.mjs inspect ./swarm-data memory-state.json
```

Send `{"operation":"formation"}` to inspect the whole live graph, or include a formation ID from `inspect`. The report identifies cycles, self-connections, linear propagation, delayed execution, learning-update counts, current values, dimensional context and execution contributions. Structural descriptions do not certify capabilities; those require experiment evidence. The old acyclic experiments continue using their saved policies.

Container instructions (not yet validated against a Docker daemon here):

```sh
docker build -t semantic-substrate .
mkdir -p swarm-data
docker run --rm -it --network none --user "$(id -u):$(id -g)" -v "$PWD/swarm-data:/data" semantic-substrate
docker run --rm --network none --user "$(id -u):$(id -g)" -v "$PWD/swarm-data:/data" semantic-substrate experiment
```

No ports are exposed and no server is deployed. The image needs to be available locally before offline container execution. State persists in the mounted directory. The process sees only the OS interfaces/files explicitly exposed to it.

Read [PRIMARY-CONDITIONS.md](PRIMARY-CONDITIONS.md) for source attribution, experimental assumptions, proofs, and outstanding gates. The prior browser observatory remains available under `npm run legacy:browser`; it is not evidence of this native mechanism.

CPU sparse execution experiment:

```sh
node native/primitive-experiment.mjs
```

Writes `evidence/cpu-primitives/report.json` and `state.json`. The live substrate
uses scan-indexed destination groups and gathers/accumulates learned directed
signals. Reports include held-out error, causal disruption/recovery, disk replay,
execution counts and CPU/memory measurements. This establishes a learned linear
configuration; it does not establish emergent neural architectures or meshes.

Feedback-driven structural recovery checks:

```sh
node --test tests/repair.test.mjs
```

The supplied search policy receives scalar performance feedback, tests reversible
relation changes, and commits improvements without being given the disrupted
connection's identity. This is an experimental repair mechanism; the diagnostic
policy itself has not emerged through learning.

Environmental trace experiment:

```sh
node --test tests/traces.test.mjs
```

Optional persistent visit records can mediate candidate contacts between
constituents visiting the same place at different times. The experiment checks
learned computation, a traces-disabled control, connection disruption/recovery,
trace expiry/provenance and restart. Visit placement and the trace policy are
supplied experimental conditions.

Relational variation and geometric realization:

```sh
node --test tests/bridge.test.mjs
```

See `evidence/relational-bridge/before.svg`, `after.svg` and `report.json` for a
small formation whose learned relation participates in both computation and
experimental elastic geometry. The mutation and geometry policies are supplied
conditions; recognizable objects and source-derived dimensional laws remain open.
