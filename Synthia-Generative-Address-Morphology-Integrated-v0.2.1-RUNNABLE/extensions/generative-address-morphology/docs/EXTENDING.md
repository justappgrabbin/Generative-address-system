# Extending the engine

The chassis is meant to absorb more discoveries without being rebuilt.

## Add a source-supported connection law
Call `engine.registerRule({ id, scope:'connection', status:'source-supported', provenance:[...], evaluate(ctx){...} })`.

## Replace a generic morphology for one channel
Call `engine.registerMorphology('ch-03-60', function execute(connectionInput){...}, {status:'source-supported', provenance:[...]})`.

The replacement only affects the morphology socket for that channel. Cynthia and the graph lifecycle remain untouched.

## Add a new graph family
Create a separate runtime under `src/extensions/` and register it. Do not overload the base connection registry.

## Add another modality
Register a projection under the extension registry. Language, image/geometry, sound, timing and embodied outputs can coexist.

## Add hands/capabilities
Use the Hands adapter or Cynthia's existing MCP/process fabric. Graphs remain structural and handless.
