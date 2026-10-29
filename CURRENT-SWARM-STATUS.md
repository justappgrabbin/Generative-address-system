# Semantic SpaceTime Swarm checkpoint — 29 October 2026

Start with [the current review handoff](observable-swarm/docs/CURRENT-HANDOFF.md).
It explains what executes, which conditions are developer-supplied, what has been
tested, and which requirements remain unfinished.

The original address-system directory and original archive are preserved.
The new local CPU substrate is under `observable-swarm/native/`.
The browser implementation is retained as legacy, not the required foundation.

From `observable-swarm`: `npm test` (Node >=22). Latest run: 12 test files passed.
Full saved experiment snapshots are preserved as compressed parts; run
`python3 scripts/restore-evidence.py` from that directory to restore them.

This branch is a checkpoint for comparison/review, not a claim of a completed
semantic world or an approval to rewrite the original architecture.
