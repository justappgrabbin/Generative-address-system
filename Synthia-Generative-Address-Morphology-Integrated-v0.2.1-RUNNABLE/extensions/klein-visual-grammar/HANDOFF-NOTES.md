# Handoff notes — klein-visual-grammar

Done: Klein tools read the photo from visual primitives; ATO (paper + her `ato()`); Monte Carlo (her tool-06); AUTOLING on her LearningMesh via KleinModuleRegistry; gaming vocab kept (4 placed by her learner logic, 52 held). See README.md and fixtures/out/.

## Engine defects (found, NOT changed)
Gates made by hash or position, not by her wheel (all r21.21 under `vendor/cynthia-original/r21.21/`):
- `substrate/mesh072/core/klein_autoling_learner.mjs:5` `const gateFor=s=>(hash(s)%64)+1;` — used at :13 `gate=gateFor(key)` (every learned grammar) and :20 `gate:gateFor(id)` (recycle nodes). Address status written as `'learned-derived'`. Default role `'what'` → Movement when no regex matches (line 8 `roles.length?roles:['what']`).
- `substrate/mesh072/core/code_dna_learner.mjs:5` same `gateFor`; used :34, :36, :37.
- `organism/EmergenceEngine.mjs:10` same `gateFor`; used :50, :54.
- `organs/legacy/autoling_morph_engine.js:378` and `:833` `const gate = (i % 64) + 1;` ("cycling through 64").
- Also position-cycling: `authorities/execution-spine/src/pure-synthia/state-space/letters.js:45` `gate: (index % 64) + 1`.
- No comment in these files calls the hash a placeholder. Git: only commit is `3fe2301` (Alexis Mcmillion, 2026-10-20, "Restore r21.21 (sha256 8a56ece9…d702)…") — an archive restore, so the real origin predates this repo. The same line already exists in the older box copy `drive-drop/.../Synthia-Autopoietic-Assembly-v0.1.0-LITE/substrate/mesh072/core/klein_autoling_learner.mjs:5`.

Real gate table expected but not wired:
- `substrate/mesh072/core/state_space_core.mjs:186-200` `StateSpace(gateTable)` throws without the real 64-gate table; header (lines 26-30) says it must be passed in from organism.html's GATE_BINARY/GATE_TRIGRAMS. `mesh/emergent_mesh.mjs:24` `EmergentMesh(gateTable)` needs it too. No organism.html in r21.21, and nothing in r21.21 passes a table in — so the learners fall back to hash.
- Real table found on the box: `real_gate_table.json` (64 gates, `{gate, binary[6], trigrams{upper,lower}}`, matches StateSpace's format), 45 copies, all sha256 `05532cf0…a146d`, e.g. `/workspace/Puresynthia-dolo/Synthia-Coherent-Autonomy-Hands-v0.3.0/assets/web/synthia-server/pure-synthia/src/synthia/emergent-state-space/data/real_gate_table.json` (+ `gate-table.mjs` "Generated verbatim from Synthia-Emergent-StateSpace-v0.6.7/data/real_gate_table.json"). Not in this repo.

How her system assigns gates (cited, not invented):
- `authorities/execution-spine/src/pure-synthia/state-space/human-design.js:34` `GATE_WHEEL` (Rave Mandala order 41,19,13,49…), `:42-46` 5.625°/gate, line = /6, color /6, tone /6, base /6; `:964 longitudeToHD(longitude)` → gate = GATE_WHEEL[floor((lon−58)/5.625)], then line/color/tone/base.
- Same rule in `r21.21/vendor/resonance-engine/core/OntologicalAddress.js:71-79` ("Gate 41 at 0°").
- Open (her call): human-design.js header F2 records three wheel anchors (58.0°, ~311.75° tropical, 46.75°); code keeps 58.0.
- Missing piece: a learned grammar/word has no degree, so mapping a rule to a longitude is undefined → those rules stay held, not guessed.

## Rewire to her execution spine (src/spine.mjs) — r21.21 copies left untouched, out of this path
- Tools: `authorities/execution-spine/.../automata/registry.js` resolveTool/createAllTools → autoling (tool-14), historical-monte-carlo (tool-06), iching-grammar (tool-04).
- Learnings: spine `merged/mesh-memory.js` AnticipatoryMemory. Address = AUTOLING tool's arcSecond (324000 = 90°) → `human-design.js` longitudeToHD (GATE_WHEEL, 58° start — her code default; F2 alternatives 311.75 / 46.75 pending Alexis) → G55.L5.C1.T5.B5.
- Real gate table `data/real_gate_table.json` (sha256 05532cf0…a146d, byte-exact) passed into spine `mesh-state-space.js` StateSpace; matches spine gateBits and built trigrams on all 64 gates.
- Game words (56): 14 placed by spine lexicon SEED_WORDS class (is/has/can/will/must AUX; the/a/this DET; in/on PREP; and/or/if CONJ; it PRON), word gate held for all; 42 held (34 words not in spine lexicon + 8 suffix rules) — needs degree rule from Alexis.
- Spine AUTOLING learned 1 rule from 37 rows: its owned engine only coins a new rule on the first sentence; later sentences return no newRules (observed, not changed).

### Spine defects (report only)
- Two wheels conflict: `state-space/addressing.js:31 addressForArcSec` is sequential (gate = floor(arc/5.625°)+1; 90° → gate 17, = registry gate) vs `human-design.js:964 longitudeToHD` (GATE_WHEEL, 58° start; 90° → gate 55).
- Hash/index gates in spine paths: `execution-address-resolver.mjs:131` `take(n, 64)` of fnv hash128 (labelled 'computational-coordinate', not semantic); `engine/intake.js:119` `parseInt(hash,16) % WHEEL_ARCSECONDS`; `state-space/letters.js:45` `(index % 64) + 1`; `merged/tool-factory.js:75` `((gate + level*7 - 1) % 64) + 1`; `engine/learning.js:454` `(from % 64) + 1`; `merged/media-field.js:447` `mediaHash({name, gates, purpose})`.
- `merged/mesh-memory.js:17 publicAddress` clamps a missing gate to 1 (a default) — so nothing is stored without a wheel address here.
- Non-celestial option seen but NOT used: `addressing.js gateFromBits` (6 bits → gate). Visual states are 8-bit; which 6 bits is Alexis's call.
