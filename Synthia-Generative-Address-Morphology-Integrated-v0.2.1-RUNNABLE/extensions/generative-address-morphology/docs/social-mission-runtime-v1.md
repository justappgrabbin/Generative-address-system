# Social and Verified Mission Runtime v1

These additive runtimes connect personal valuation to social interaction and independently observed execution. They do not replace the existing address, channel, graph, or authority registries.

## Connected state flow

```text
canonical address + base values + private perspective
                    ↓
       intended values / social expression
                    ↓
 directed connection → message → recipient valuation
                    ↓
   explicit feedback and/or immutable choice transition
                    ↓
 mission → observation → action proposal → exact capability check
                    ↓
       host actuator → observed outcome → independent verifier
```

Canonical coordinates and previous revisions remain available. Personal words and positions affect effective values, not canonical coordinate identity. Social and mission events use append-only, digest-checked provenance chains.

## Social runtime

An agent owns an immutable choice state and an isolated adaptive perspective. A directed relationship is required before a message can be queued.

```js
let world = engine.socialWorld({ maxAgents: 64, maxMessagesPerTick: 16 });
world = engine.addSocialAgent(world, {
  id: 'guide', address, values: { freedom: 4, security: 4 },
  lexicon: { open: { freedom: 4, security: -2 } },
});
world = engine.addSocialAgent(world, {
  id: 'adaya', address: otherAddress, values: { energy: 2 },
  lexicon: { open: { freedom: -1, security: 5 } },
});
world = engine.connectSocialAgents(world, {
  from: 'guide', to: 'adaya', connection: 'channel:example', importance: 0.5,
});
const queued = engine.queueSocialMessage(world, {
  from: 'guide', to: 'adaya', words: 'open',
  observedValues: { freedom: 3, security: 9 },
  choice: {
    nextAddress: thirdAddress,
    valueOperations: [{ op: 'add', key: 'energy', amount: 1 }],
    modeChanges: { social: 'LSM' },
  },
});
const { world: nextWorld, deliveries } = engine.stepSocialWorld(queued.world);
```

`observedValues` is optional. Only explicit observations produce durable personal adaptation. A message choice always uses the established relationship's connection; the message cannot override it. Removing an agent also removes its relationships and queued messages.

World ticks are bounded. Excess queued messages remain queued. Empty ticks do not manufacture revisions or interactions.

### Expressing an intention

`queueSocialIntent` performs a deterministic greedy search over the sender's known vocabulary. It selects words only when they reduce squared distance to explicitly supplied target registers.

```js
const queued = engine.queueSocialIntent(world, {
  from: 'guide', to: 'adaya',
  targetValues: { freedom: 8, security: 2 },
  maxWords: 3,
});
```

This is an inverse use of the sender's personal lexicon. It does not invent a meaning for an unknown word or claim to solve open-ended natural-language planning.

### Persistence

`engine.restoreSocialWorld(JSON.parse(JSON.stringify(world)))` validates agents, canonical addresses, relationships, queued messages, and the complete provenance chain. Persist snapshots in application storage; no hidden database or background service is installed by this module.

## Verified mission runtime

A mission contains a canonical choice state, exact capability grants, an execution budget, an observation, and an independent completion predicate. Host actuators and planners are supplied explicitly by the application.

```js
const mission = engine.mission({
  id: 'reach-target',
  goal: 'Reach the observed target',
  address,
  capabilities: ['simulation.move'],
  maxSteps: 4,
  initialObservation: { reached: false, distance: 2 },
  completionTest: ({ observation }) => observation?.reached === true,
});

const runner = engine.missionRunner({
  actuators: {
    move: {
      requiredCapability: 'simulation.move',
      execute: async action => simulation.move(action.input),
    },
  },
  planner: async ({ observation }) => ({
    type: 'move', input: { distance: observation.distance },
  }),
});
const result = await engine.runMission(runner, mission);
```

The runner repeats this bounded loop:

1. independently test the current observation;
2. obtain an action from the observation-dependent planner;
3. resolve the registered actuator;
4. require its exact capability in the mission grants;
5. execute the host action;
6. serialize and store the resulting observation;
7. independently test completion again.

A planner's `done`, `claimed`, or similar field is not completion evidence. An unregistered actuator, denied capability, planner failure, verifier failure, or actuator exception produces an explicit result and provenance event. Wildcard capabilities are rejected. No shell, desktop-control, filesystem, network, or operating-system actuator is enabled by default.

An actuator may return `{ observation, choice }`. The optional choice is applied immutably to the mission state before completion verification. This connects host outcomes back to addresses, values, and computational modes.

### Mission persistence

`engine.missionSnapshot(mission)` removes the executable verifier and preserves JSON state, latest observation, choice state, and provenance. Restoration requires the application to rebind the verifier explicitly:

```js
const restored = engine.restoreMission(snapshot, { completionTest });
```

Restoration validates the address, registers, capabilities, latest observation, and every provenance link. Executable planner/actuator/verifier functions are never deserialized from snapshots.

## Adaptation and autonomy boundaries

The system adapts in three implemented ways:

- personal lexicon and position effects adapt from explicit observed values;
- social expressions adapt to requested target values through the current private vocabulary;
- mission planners can choose different actions as observations change.

Canonical baselines and past revisions remain stable. Temporary observations do not automatically become durable personal learning. This preserves the useful separation between sample-specific adaptation and persistent adaptation discussed in *Semantic Self-adaptation: Enhancing Generalization with a Single Sample* (arXiv:2208.05788), without importing that paper's image-segmentation algorithm.

This runtime supports declarative goals, numeric intentions, and application-supplied planners. It does **not** yet translate arbitrary prose into new host capabilities, autonomously invent a verifier, or compile an unrestricted game/app from a connection graph. Those require additional explicit program schemas and verified generators.
