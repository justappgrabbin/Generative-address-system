import { PureSynthiaLearningCore } from '../packages/pure-synthia/src/pure-synthia-learning-core.mjs';
import SynthiaCoreRuntime from '../packages/pure-synthia/src/core/runtime.mjs';
import * as HD from '../packages/human-design-research/src/index.mjs';
import { HumanSuccessMetabolism } from '../packages/human-success/human-success-metabolism.mjs';
import { MycelialSuccessMesh } from '../packages/human-success/mycelial-success-mesh.mjs';
import { GateLineProcessField } from '../packages/human-success/process-field.mjs';
import { SynthiaSystem } from '../packages/execution-spine/src/synthia-system.mjs';

export class SynthiaUnifiedSystem {
  constructor(options={}) {
    this.version='0.5.1';
    this.learning=new PureSynthiaLearningCore(options.learning||{});
    this.cognition=new SynthiaCoreRuntime(options.core||{});
    this.hd=HD.createEngine();
    this.success=new HumanSuccessMetabolism(options.success||{});
    this.mycelium=new MycelialSuccessMesh(options.mycelium||{});
    this.processField=new GateLineProcessField(options.processField||{});
    // Canonical execution organism. This is instantiated by the unified host so
    // artifact execution is reachable from the same public facade as learning,
    // cognition, HD research and the success/process layers.
    this.executionSystem=options.executionSystem ?? new SynthiaSystem(options.execution||{});
  }
  capabilities(){
    return {
      stateSpace:Object.keys(this.cognition.stateSpace),
      ato:Object.keys(this.cognition.ato),
      klein:Object.keys(this.cognition.klein),
      humanDesign:this.hd.capabilities,
      learning:['registration','book-ingest','sentence-mesh','scientist-loop','training-journal'],
      success:['human-success-metabolism','mycelial-success-mesh','gate-line-process-field'],
      execution:{
        host:'packages/execution-spine',
        stages:[...this.executionSystem.executionPipeline.wiringAudit().stages],
        runtimeAdapters:this.executionSystem.listRuntimeAdapters(),
      },
      mobile:'apps/mobile'
    };
  }

  registerRuntimeAdapter(adapter){ this.executionSystem.registerRuntimeAdapter(adapter); return this; }
  listRuntimeAdapters(){ return this.executionSystem.listRuntimeAdapters(); }
  async executeArtifact(artifact,context={}){
    const before=this.executionSystem.executionSnapshot();
    const result=await this.executionSystem.executeArtifact(artifact,{...context,source:context.source||'unified-host'});
    const after=this.executionSystem.executionSnapshot();
    // Connect observable execution back into the existing root learning journal.
    // Failure is recorded as failure rather than swallowed or converted to success.
    this.learning.training.record({
      task:'artifact-execution',
      stateBefore:{executionSequence:before.runSequence,fieldState:before.fieldState},
      toolPath:['synthia-unified-system','execution-spine',result.path||'unknown'],
      interaction:{name:artifact?.name??artifact?.originalName??null,type:artifact?.type??null,source:context.source??null},
      stateAfter:{executionSequence:after.runSequence,fieldState:after.fieldState,canonicalAddressKey:result.canonicalAddressKey??null},
      observedExpression:{ok:Boolean(result.ok),path:result.path??null,foldHash:result.pipeline?.fold?.foldHash??null},
      success:Boolean(result.ok),
      error:result.ok?null:(result.error??result.result?.error??'execution failed'),
      score:result.ok?1:0,
      metadata:{placementRecordId:result.placementRecordId??null,cacheHit:Boolean(result.pipeline?.cache?.analysisHit)},
    });
    return result;
  }
  executionSnapshot(){ return this.executionSystem.executionSnapshot(); }
  executionWiringAudit(){ return this.executionSystem.wiringAudit(); }
  calculateHumanDesign(input){ return HD.calculateHumanDesign(input); }
  calculateResearchChart(input,location={}){ return HD.calculateResearchChart(input,location); }
  toStellarInput(chart,extra={}){ return HD.toStellarInput(chart,extra); }
  registerEntity(payload){ return this.learning.registry.register(payload); }
  transition(entityId,payload){ return this.learning.registry.transition(entityId,payload); }
  contact(a,b,payload={}){ return this.learning.registry.contact(a,b,payload); }
  ingestBook(payload){ return this.learning.books.ingest(payload); }
  research(question){ return this.learning.scientist.openQuestion(question); }
  snapshot(){ return {version:this.version,learning:this.learning.snapshot(),execution:this.executionSnapshot(),capabilities:this.capabilities()}; }
}
export default SynthiaUnifiedSystem;
