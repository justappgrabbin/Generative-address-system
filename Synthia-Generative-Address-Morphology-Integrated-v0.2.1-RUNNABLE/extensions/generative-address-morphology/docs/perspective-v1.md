# Adaptive Perspective v1

Adaptive perspective makes value relational to the person, their words, and their current position. Canonical numeric addresses and base values are not rewritten by personal interpretation.

## Principle

The same base numbers can produce different effective values and proportions when evaluated through different people, personal word associations, or positions. Unknown words have no invented effect. A person must supply an initial association or explicit feedback before an unknown word changes value.

This module implements one transparent reference policy:

- personal word and position effects are added to base values;
- effective values retain their signs;
- proportions are the normalized positive parts of effective values;
- explicit observed values update personal effects with a bounded delta rule.

This is an adaptive implementation policy, not a claimed universal law of meaning. Other valuation policies can be added without changing numeric addresses.

## Create and evaluate

```js
const person = engine.perspectiveState({
  person: 'adaya',
  position: 'inner',
  lexicon: {
    open: { freedom: 4, security: -2 },
  },
  positions: {
    inner: { freedom: 1 },
    outer: { security: 3 },
  },
});

const valuation = engine.evaluatePerspective(person, {
  values: { freedom: 4, security: 4 },
  words: 'open',
});
```

The result contains `baseValues`, `effectiveValues`, `proportions`, `activeWords`, `unknownWords`, the person's position, and the perspective revision. The original numeric values are returned unchanged as `baseValues`.

## Adapt from explicit feedback

```js
const { state, event, before, after } = engine.adaptPerspective(person, {
  values: { freedom: 4, security: 4 },
  words: 'open',
  position: 'inner',
  observedValues: { freedom: 8, security: 2 },
  learningRate: 0.25,
});
```

Adaptation creates a new personal revision and a deterministic provenance event. It never mutates the prior perspective, canonical coordinates, or another person's state. `learningRate` is in `(0,1]`. Observed values must be explicitly supplied; the engine does not invent feedback.

Each person needs an independent state created with `engine.perspectiveState`. Application storage can persist these immutable revisions and events using the existing provenance infrastructure.
