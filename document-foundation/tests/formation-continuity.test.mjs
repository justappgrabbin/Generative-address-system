import test from 'node:test';
import assert from 'node:assert/strict';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const pair={from:'autoling',to:'conversation'};
test('packet crossings and structural levels read one channel, stabilize on the third interaction and replay',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 assert.equal(app.formation(pair).status,'NOT_ENCOUNTERED');
 for(let count=1;count<=3;count++){
  const result=await app.chat('autoling "the bird moves" then conversation "received"');
  assert.equal(result.outcome.learned.mode,'known-call');
  assert.equal(result.outcome.learned.output.chained,true);
  const view=app.formation(pair),record=app.system.channels.get(pair.from,pair.to);
  assert.equal(view.packet.crossings,count);assert.equal(view.structural.levels,count);
  assert.equal(record.uses,count);assert.equal(view.structural.stable,count===3);
  assert.equal(view.packet.stabilizedSeq,view.structural.stabilizedSeq);
  if(count<3)assert.equal(view.capability,null);
 }
 const before=app.system.channels.get(pair.from,pair.to);
 // Read-only perspective inspection cannot create another crossing or level.
 const response=await app.fieldCommand({operation:'formation',payload:pair});
 assert.equal(response.field.status,'STABLE');assert.equal(response.field.capability.compose,'sequential');
 assert.deepEqual(app.system.channels.get(pair.from,pair.to),before);
 // The relation retains identity and packet references, not the active packet payload.
 assert.deepEqual(before.packetKeys,['pkt-0001','pkt-0002','pkt-0003']);assert.equal('payload' in before,false);
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(restored.formation(pair),app.formation(pair));
 assert.deepEqual(restored.system.mesh.snapshot(),app.system.mesh.snapshot());
 const stabilized=restored.formation(pair).packet.stabilizedSeq;
 await restored.chat('autoling "the bird moves" then conversation "again"');
 const continued=restored.formation(pair);
 assert.equal(continued.packet.crossings,4);assert.equal(continued.structural.levels,4);
 assert.equal(continued.packet.stabilizedSeq,stabilized);
 assert.equal(continued.identity,response.field.identity);
});
