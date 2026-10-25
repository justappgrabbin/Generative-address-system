# Numeric Address and Choice Transition v1

This is an additive, user-supplied starting contract. It does not replace the existing canonical `arcAxis` authority, infer missing coordinates, or claim that every representable coordinate has an established meaning.

## Coordinate order

1. `planetary`: integer 1–13
2. `dimension`: integer 1–5
3. `gate`: integer 1–64
4. `line`: integer 1–6
5. `color`: integer 1–6
6. `tone`: integer 1–6
7. `base`: integer 1–5
8. `degree`: integer 0–29
9. `minute`: integer 0–59
10. `second`: integer 0–59
11. `arcsecond`: integer 0–99
12. `zodiac`: integer 1–12
13. `house`: integer 1–12

The existing dimension order is preserved:

1. Movement
2. Evolution
3. Being
4. Design
5. Space

With these fixed ranges, the mixed-radix space contains 6,987,202,560,000,000 addresses. This is representational capacity, not a count of validated meanings. Connection order, value exchanges, and choice histories create path-dependent outcomes beyond static address count.

## Address API

```js
const record = engine.numericAddress(0n);
const index = engine.numericAddressIndex(address);
const contract = engine.numericAddressContract();
```

`encodeNumericAddress` returns a BigInt. `decodeNumericAddress` accepts a BigInt, safe integer, or decimal string. Encoding is lossless and reversible. A numeric index is a coordinate, not a content digest or a substitute for semantic provenance.

## Choice API

```js
const initial = engine.choiceState({
  address,
  values: { energy: 10 },
  modes: { node: 'MC' },
});

const { state, event } = engine.choose(initial, {
  connection: 'channel:example',
  nextAddress: anotherAddress,
  valueOperations: [
    { op: 'transfer', from: 'energy', to: 'reserve', amount: 2 },
    { op: 'add', key: 'experience', amount: 1 },
  ],
  modeChanges: { node: 'DFF' },
});
```

Supported value operations are `set`, `add`, and `transfer`. They are explicit numeric operations, not inferred universal laws. Every choice requires a selected connection, creates a new immutable revision, and emits a deterministic provenance event linked to the previous state and event. Existing state is never mutated.

Words and semantic labels can later bind to addresses, connections, value patterns, or choice histories without changing this numeric execution layer.
