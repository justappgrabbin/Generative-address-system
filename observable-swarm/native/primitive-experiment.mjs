import { encounterExperiment } from './encounter-experiment.mjs';
import { save, restore } from './storage.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const directory = resolve(process.argv[2] || 'evidence/cpu-primitives');
await mkdir(directory, { recursive: true });
const cpu = process.cpuUsage(), start = performance.now(), before = process.memoryUsage();
const { substrate, report } = encounterExperiment();
const snapshot = resolve(directory, 'state.json');
await save(snapshot, substrate);
const restored = await restore(snapshot);
const probe = { a: 1.237, b: -1.112, distant: 0.3 };
const restartDifference = Math.abs(substrate.evaluate(probe).result - restored.evaluate(probe).result);
const used = process.cpuUsage(cpu), after = process.memoryUsage();
const evidence = { ...report, diskRestartDifference: restartDifference,
  executionCounts: substrate.executionCounts,
  resources: { wallMilliseconds: performance.now() - start, cpuUserMicroseconds: used.user,
    cpuSystemMicroseconds: used.system, rssBytes: after.rss, heapUsedBytes: after.heapUsed,
    heapChangeBytes: after.heapUsed - before.heapUsed, peakRSSKiB: process.resourceUsage().maxRSS },
  measurementScope: 'Training, held-out assessment, disruption, restoration, provenance replay, disk save/load and probe. RSS/heap include JavaScript runtime and histories; counts are logical operations, not hardware instructions.',
  acceptance: 'Learned sparse linear transformation, not proof of semantic understanding, emergent hidden neural architecture, mesh formation or full dimensional realization.' };
await writeFile(resolve(directory, 'report.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ heldOutMSE: evidence.heldOutMSE, disruptedMSE: evidence.disruptedMSE,
  recoveredMSE: evidence.recoveredMSE, diskRestartDifference: restartDifference, executionCounts: evidence.executionCounts, resources: evidence.resources }, null, 2));
