import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Substrate } from './substrate.mjs';
import { save, restore } from './storage.mjs';
import { functionalExperiment, imageExperiment, surfaceSVG } from './experiments.mjs';
import { readPGM } from './files.mjs';
import { encounterExperiment } from './encounter-experiment.mjs';
import { adaptationExperiment } from './adaptation-experiment.mjs';
import { memoryExperiment } from './memory-experiment.mjs';
import { inspectFormation } from './inspection.mjs';

const mode = process.argv[2] || 'inspect';
const directory = resolve(process.argv[3] || process.env.SWARM_DATA || './swarm-data');
await mkdir(directory, { recursive: true });
if (mode === 'memory-experiment') {
  const { substrate, report } = memoryExperiment();
  const control = memoryExperiment({ selfObservation: false }).report;
  await save(join(directory, 'memory-state.json'), substrate);
  const restored = await restore(join(directory, 'memory-state.json'));
  if (JSON.stringify(restored.snapshot()) !== JSON.stringify(substrate.snapshot())) throw Error('Filesystem restart mismatch');
  const evidence = { report, control, timestamp: new Date().toISOString(), node: process.version };
  await writeFile(join(directory, 'memory-report.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ heldOutMSE: report.heldOutMSE, disruptedMSE: report.disruptedMSE, recoveredMSE: report.recoveredMSE,
    restartMSE: report.restartMSE, samePresentInput: report.samePresentInput,
    structure: report.inspection.structuralDescription, relations: report.inspection.relations,
    controlMSE: control.heldOutMSE, limits: report.limits }, null, 2));
} else if (mode === 'adaptation-experiment') {
  const { substrate, report } = adaptationExperiment();
  const controls = {
    noFeedback: adaptationExperiment({ feedbackAfterChange: false }).report,
    noNewContact: adaptationExperiment({ bringNewContact: false }).report
  };
  await save(join(directory, 'adaptation-state.json'), substrate);
  const restored = await restore(join(directory, 'adaptation-state.json'));
  if (JSON.stringify(restored.snapshot()) !== JSON.stringify(substrate.snapshot())) throw Error('Filesystem restart mismatch');
  const evidence = { report, controls, timestamp: new Date().toISOString(), node: process.version };
  await writeFile(join(directory, 'adaptation-report.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ report: { ...report, retiredRelations: report.retiredRelations.map(e => ({ id: e.id, retiredAt: e.retiredAt, historyEntries: e.history.length })), events: `${report.events.length} events; see adaptation-report.json` }, controls: Object.fromEntries(Object.entries(controls).map(([id, r]) => [id, { adaptedMSE: r.adaptedMSE, edges: r.after.edges }])) }, null, 2));
} else if (mode === 'encounter-experiment') {
  const { substrate, report } = encounterExperiment();
  const controls = {
    disabled: encounterExperiment({ encounters: false }).report,
    separated: encounterExperiment({ targetPosition: [8, 8] }).report,
    insufficientEncounters: encounterExperiment({ minimum: 10000 }).report
  };
  await save(join(directory, 'encounter-state.json'), substrate);
  const restored = await restore(join(directory, 'encounter-state.json'));
  if (JSON.stringify(restored.snapshot()) !== JSON.stringify(substrate.snapshot())) throw Error('Filesystem restart mismatch');
  const evidence = { report, controls, timestamp: new Date().toISOString(), node: process.version };
  await writeFile(join(directory, 'encounter-report.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} else if (mode === 'experiment') {
  const functional = functionalExperiment();
  await save(join(directory, 'functional-state.json'), functional.substrate);
  // Test the actual filesystem restart path, not only object serialization.
  const restarted = await restore(join(directory, 'functional-state.json'));
  if (restarted.tick !== functional.substrate.tick) throw Error('Filesystem restart mismatch');
  const source = await readPGM(process.argv[4] || new URL('./fixtures/glyph.pgm', import.meta.url));
  const visual = imageExperiment({ source });
  await save(join(directory, 'image-state.json'), visual.substrate);
  await writeFile(join(directory, 'reconstructed.svg'), surfaceSVG(visual.substrate, Array.from({ length: 16 }, (_, i) => `surface-${i}`)));
  const report = { functional: functional.report, image: visual.report, timestamp: new Date().toISOString(), node: process.version };
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, image: { ...visual.report, trace: `[${visual.report.trace.length} contributions; see report.json]` } }, null, 2));
} else if (mode === 'inspect') {
  let substrate;
  const snapshotPath = join(directory, process.argv[4] || 'state.json');
  try { substrate = await restore(snapshotPath); }
  catch (e) { if (e.code !== 'ENOENT') throw e; substrate = new Substrate({ execution: 'discovered-dag', encounters: { radius: 0.12, minimum: 4 }, adaptation: { pruneWeight: 0.01, patience: 12, recentContact: 12 } }); }
  const terminal = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
  console.log('Local substrate. JSON commands: add, offer, bind, evaluate, feedback, idle, disrupt, place; inspect, formation, history, trace, save, quit. No server or network.');
  for await (const line of terminal) {
    try {
      const message = JSON.parse(line), { operation, data } = message;
      let result;
      if (operation === 'quit') break;
      if (operation === 'save') { await save(snapshotPath, substrate); result = 'saved'; }
      else if (operation === 'inspect') result = data?.id ? substrate.nodes.get(data.id) ?? substrate.edges.get(data.id) ?? null : { tick: substrate.tick, nodes: substrate.nodes.size, relations: substrate.edges.size, formations: substrate.formations };
      else if (operation === 'trace') result = substrate.lastTrace;
      else if (operation === 'formation') result = inspectFormation(substrate, data?.id ?? null);
      else if (operation === 'history') result = data?.id ? { events: substrate.events.filter(e => e.constituent === data.id || e.from === data.id || e.to === data.id), retiredRelations: substrate.retired.filter(e => e.id === data.id || e.from === data.id || e.to === data.id) } : { events: substrate.events, retiredRelations: substrate.retired };
      else if (['add', 'offer', 'bind', 'evaluate', 'feedback', 'idle', 'place'].includes(operation)) result = substrate[operation](data) ?? 'ok';
      else if (operation === 'disrupt') { substrate.disrupt(data.ids, data.enabled); result = 'ok'; }
      else throw Error('Unsupported command');
      console.log(JSON.stringify({ ok: true, result }));
    } catch (error) { console.log(JSON.stringify({ ok: false, error: error.message })); }
  }
  await save(snapshotPath, substrate);
  terminal.close();
} else throw Error('Usage: node native/main.mjs [inspect|experiment|encounter-experiment|adaptation-experiment|memory-experiment] [data-directory]');
