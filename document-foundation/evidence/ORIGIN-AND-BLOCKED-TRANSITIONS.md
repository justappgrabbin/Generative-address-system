# Origin continuity and blocked morph transitions

Compared Burgess, *Agent Semantics, Semantic Spacetime, and Graphical Reasoning* (https://arxiv.org/abs/2506.07756), especially its discussion of merging paths and lost history, with the supplied macrocosmic/microcosmic image and the user's Architecture document, §II Origin as Anchor (https://docs.google.com/document/d/1m4jCA-T-KntEXQ137pYEbaVQns6Ga36-pwCmH51DYbA/edit).

Corrections in the existing execution path:

- `SourceStateIntegration.resolve`: an explicitly identified agent retains its origin through later resolutions. Explicit origins conflicting with that recorded history are rejected. An unknown origin is labeled `first-observed`, not asserted to be a birth origin. Previous activation receipts remain linked. Anonymous activations are not assumed to be the same entity.
- `Foundation.apply`: morph statuses awaiting surface endpoints or a renderer produce an outer `BLOCKED` transition with the operation, source activation, missing requirements and preserved packet reference. They no longer report successful execution. The original packet and receipt remain intact in the journal.
- `Foundation.transact`: new entries record `stateContinuityVersion: origin-relative.v1`. Older entries without this policy retain their previous replay behavior.

This does not install Burgess's relation taxonomy as Synthia's ontology. It does not resolve the outstanding contextual sentence rules or implement the missing renderer. A repeated morph attempt preserves the earlier receipt; successful rendering after supplying endpoints is not demonstrated by these tests.

Validation: 78 foundation tests and 24 execution-spine tests passed. The rebuilt offline module graph (194 modules) passed its execution and image checks with optional facilities unavailable. Tests cover movement, conflicting origins, reload, blocked packet retention and subsequent attempts.
