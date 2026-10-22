# Klein-Neural-Symbolic bridge (first integration slice)

This is **an additive execution adapter**, not a second semantic state space, another Klein engine, or a replacement Model Maker.

## Existing authorities

- The execution spine remains the canonical address authority. No hash-based or character-code-based addresses are created here.
- The existing KleinContextRuntime evaluates mounted AutoLing and DISEMINER tools before a program runs and records a contextual witness.
- The Neural-Network-Builder.zip donor already resides in extensions/generative-address-morphology/vendor/ and is untouched.
- The actual Model Maker trainer resides in justappgrabbin/Stellarproximology-lab/Modelmaker-repair/app.py and is untouched.
- Foundry stays its own factory. The original Neural-Symbolic Machines learner is not rewritten.

## What executes now

This bridge accepts a preconstructed ordered symbolic program, validates a caller-supplied **full canonical address**, produces a Klein witness, executes registered capability callbacks, resolves named previous outputs using $result references, and records success/failure receipts. It refuses unregistered operations, forward references, undefined outputs and unauthorized side effects.

Operations are registered only when the caller provides **real callable adapters**: neuralNetBuilder, modelMaker, or foundry. mesh.invoke uses the existing assembly. Training/mutations are fail-closed unless the caller-provided authorize policy returns true. The autonomy field never bypasses authorization.

The wiring function is wireNeuralSymbolic from src/wire-synthia.mjs. A factory adapter accepts (input, {address, context, witness, previous}) and must return a serializable, non-undefined result.

## Honest scope limitations

This first slice does **not** retrain the original Neural-Symbolic Machines policy network, invoke the archived Neural Network Builder's still-unverified internal API, train a GPT-2 with Model Maker, or produce an Android APK. The original Python/TensorFlow Neural-Symbolic learner and Gradio/PyTorch Model Maker require inspected, tested adapters and runtime isolation first. In particular, Model Maker's train_model entrypoint is a Python function, not yet a JS callable.

The contract tests use synthetic factory callbacks to validate dispatch and permissions; they do not prove neural training happened. A true end-to-end test must run the full Synthia assembly with genuine factory adapters, validate artifacts and metrics, and reload trained weights. Receipts currently live in memory; wire them into the existing ledger/Vault instead of creating another store.

Run isolated tests from the runnable root with:

    node --test extensions/klein-neural-symbolic/tests/*.test.mjs

This branch does not modify existing authority files.
