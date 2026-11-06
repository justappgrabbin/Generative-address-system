# Klein / language-contact capability fix (Pink, 2026-11-05)

## Scope
Fix the 7 failing capability tests from PR #8 (`audit-learning-capability-20261030`) without overwriting originals, then retrain the language-contact model on `/workspace/alexis-batch/books2` using the corrected tools.

**Principle:** numbers are measurements; **words are measurements of expression.**

Branch (local only, not pushed): `fix/klein-capability-20261105` at `/workspace/pink-klein-fix`.
No merge, no push to main, no deploy.

## Labelled copies (originals untouched)

| Tool | Original (untouched) | Fixed |
|------|----------------------|-------|
| AUTOLING | `.../tools/tool-14-autoling.js` (+ `fixed/tool-14-autoling.ORIGINAL.js`) | `.../tools/fixed/tool-14-autoling.fixed.js` |
| DISEMINER | `.../tools/tool-15-diseminer.js` (+ `.ORIGINAL.js`) | `.../tools/fixed/tool-15-diseminer.fixed.js` |
| Monte Carlo | `.../tools/tool-06-historical-monte-carlo.js` (+ `.ORIGINAL.js`) | `.../tools/fixed/tool-06-historical-monte-carlo.fixed.js` |
| State space | `.../core/structural-space.mjs` (+ `.ORIGINAL.mjs`) | `.../core/fixed/structural-space.fixed.mjs` |

Capability test importing fixed tools: `tests/learning-capability-audit-fixed.test.mjs`
Original PR audit test (still fails 7/12 against originals): `tests/learning-capability-audit.test.mjs`

Also related prior labelled reader fix: `/workspace/best-klein-tools/fixed/` (AutoLingReader / DiseminerBook) — left as-is; GAS execution-spine tools are what PR #8 exercises.

## What changed in each tool

### AUTOLING (`tool-14-autoling.fixed.js`)
1. **Second sentence learning:** H1 coin-on-failure now runs for every new unparsable sentence (not only when `grammar.length === 0`).
2. **Cross-frame H2:** fillers that differ in exactly one slot across sentence rules join a `Class_n`.
3. **Expression lexicon:** words measured by frame role (e.g. DET + X + VERB ⇒ X is NOUN). Repeated contextual exposure reclassifies domain terms instead of leaving POS `UNKNOWN`.

### DISEMINER (`tool-15-diseminer.fixed.js`)
3. **Cross-passage contradictions:** `extractClaims` cross-references against **all** stored claims, not only the current batch.
4. **CJK kept:** tokenize with `\p{L}\p{N}`; non-ASCII tokens kept even at length 1 (乾 坤 陰 陽 → wordCount 4).

### State space (`structural-space.fixed.mjs`)
5. **Learned relation resolves term:** `unresolvedTokens` excludes tokens that match a `recognition.graph.relations[].label`; adds `resolutionNotes` explaining why.

### Monte Carlo (`tool-06-historical-monte-carlo.fixed.js`)
6. **Negative weights:** rejected (`ok:false`, `status:'invalid-weights'`) — never accepted as probabilities.
7. **Empty hypotheses:** `variants:{}` → `ok:false`, `status:'no-evidence'`.

## Test results
- Fixed capability suite: **12/12 pass** (all 7 capability failures fixed; 5 controls still pass).
- Original audit against untouched originals: still **5 pass / 7 fail** (proves originals unchanged).
- Original `npm run test:all` (capability files aside): **66/66 pass**.
- best-klein-tools: **79/79 pass**.

## Retrain output (labelled, nothing overwritten)
Dir: `/workspace/pink-klein-fix/retrain-out-20261105/`
- `language-contact-model.fixed.json` — full model summary
- `host-grammar.fixed.json` — contacted host grammar
- `host-expression-lexicon.fixed.json` — word→expression measurements
- `host-contradictions.fixed.json` — cross-passage contradiction links
- `book-*.json` — per-book summaries

Script: `fixed-retrain/retrain-language-contact.mjs`

## Needs from Grok Bot / Alexis
1. **Push yes?** Local branch `fix/klein-capability-20261105` is ready; not pushed. Pushing would let CI re-run PR #8 style checks against fixed copies (or a follow-up PR that wires fixed tools).
2. **Wire into production?** Originals still used by default. Promoting fixed → live tools needs her explicit yes (and should keep ORIGINAL labelled backups).
3. **Full-book vs capped retrain:** retrain used `MAX_SENTENCES=120` per book for cost. Say if she wants a full uncapped pass overnight.
4. Do **not** merge PR #8 as-is (it only adds failing tests); merge/fix strategy is her call.
