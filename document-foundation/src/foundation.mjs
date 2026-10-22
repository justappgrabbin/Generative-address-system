import { SynthiaSystem } from '../vendor/spine/src/synthia-system.mjs';
import { UniversalRuntime } from '../vendor/spine/src/universal-runtime.mjs';
import { validateCanonicalAddress, canonicalAddressKey } from '../vendor/spine/src/canonical-address.mjs';
import { SynthiaAutomata } from '../vendor/spine/src/pure-synthia/engine/synthia.js';
import { UniversalExecutionBridge } from '../vendor/browser/src/integration/universal-execution-bridge.js';
import { AutomataIngestionExecutionKernel } from '../vendor/ingestion/src/automata/ingestion-execution-kernel.mjs';
import { BrowserAutomataStore } from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
import { BrowserExecutionSurface } from '../vendor/ingestion/src/automata/browser-execution-surface.mjs';
import { normalizeArtifact } from '../vendor/ingestion/src/automata/artifact-normalizer.mjs';
import { KleinEngine } from '../vendor/klein-full-toolkit.mjs';
import { AtoEngine } from '../vendor/ato-engine.mjs';
import { ExecutionPipeline, MemoryExecutionPipelineStore } from '../vendor/spine/src/execution-pipeline.mjs';
import { LineageAdapter } from './lineage-adapter.mjs';
import { FoundationStore } from './storage-adapter.mjs';
import { AddressedField, coordinateKey } from './addressed-field.mjs';
import { MorphMirMemory } from '../vendor/morphmir-memory.mjs';
import { installDocumentToolPolicy } from './document-tool-policy.mjs';
import {ImageMemory} from './image-memory.mjs';
import {VisualSensory} from './visual-sensory.mjs';
import {decodeImageBytes} from './browser-image-decoder.mjs';
import {sha256Hex} from '../vendor/sha256.mjs';
import {composeImage} from './image-structure.mjs';
import {parseAddress} from './operational-address.mjs';
import {resolveFieldToolInput} from './field-tool-input.mjs';

const copy = v => structuredClone(v);
// Only adapters are added here. Calculus, automata, Klein, ATO, factory,
// reduction, address signing and execution remain the supplied implementations.
export class Foundation {
  constructor({store = new FoundationStore({databaseName:'synthia-foundation-v1'})} = {}) {
    this.store = store;
    this.field = new AddressedField();
    this.photoMemory = new MorphMirMemory();
    this.photos = new Map();
    this.imageMemory = new ImageMemory();
    this.visualSensory = new VisualSensory();
    this.runtime = new UniversalRuntime();
    this.runtime.registerRealizer('state-machine',async spec=>{
      const machine=this.runtime.createMachine(spec.definition);
      for(const event of spec.events??[])await machine.send(event);
      return machine.snapshot();
    });
    this.runtime.registerRealizer('dependency-graph',async(spec,context)=>this.runtime.runGraph(spec.nodes,{context,concurrency:spec.concurrency??1}));
    this.surface = new BrowserExecutionSurface();
    const chamber = {
      executeJavaScript: async (source, options={}) => {
        const artifact = await normalizeArtifact(source, {name:'realization.js'});
        const out = await this.surface.execute(artifact, {globals:options.context});
        if (!out.ok) throw new Error(out.error);
        return {ok:true, ...out.result};
      },
      executeWasm: async (bytes, imports={}) => {
        const out = await this.surface.execute(await normalizeArtifact(bytes,{name:'realization.wasm'}),{wasmImports:imports});
        if (!out.ok) throw new Error(out.error);
        return {ok:true, ...out.result, exports:out.result.returnValue.exports};
      }
    };
    this.system = new SynthiaSystem({engine:new SynthiaAutomata(),executionBridge:new UniversalExecutionBridge({sandbox:chamber})});
    this.documentToolPolicy = installDocumentToolPolicy(this.system.engine);
    this.lineage = new LineageAdapter(this.system.engine);
    this.kernel = new AutomataIngestionExecutionKernel({store,executionSurface:this.surface});
    this.pipeline = new ExecutionPipeline({addressResolver:this.system.addressResolver,mesh:this.system.mesh,store:new MemoryExecutionPipelineStore(),executeArtifactCore:(artifact,context)=>this.executeCore(artifact,context)});
    this.klein = new KleinEngine();
    this.ato = new AtoEngine({latentResolution:[1,1],numEmbeddings:64,embeddingDim:64});
    this.ato.learnSystem('foundation','State-space foundation','custom');
    this.history = [];
    this.queue = Promise.resolve();
    this.ready = this.restore();
  }
  async restore() {
    const saved = await this.store.get('foundation:journal') ?? [];
    for (const entry of saved) {
      const replayed=await this.apply(entry.input, entry.context, entry.kind, entry.id);
      if(entry.kind==='image'&&entry.result.image&&(
        replayed.image.pixelSha256!==entry.result.image.pixelSha256||
        replayed.image.artifact.sha256!==entry.result.image.artifact.sha256
      ))throw new Error(`Replay differs from landed image ${entry.id}; preserve history and use a versioned migration`);
    }
    this.history = saved;
    return this;
  }
  transact(input, context, kind) {
    const operation = this.queue.then(async () => {
      await this.ready;
      if(this.storageFault)throw new Error('Reload the foundation from its landed journal after the storage failure');
      const id = `entry:${this.history.length+1}`;
      const result = await this.apply(input, context, kind, id);
      const entry = copy({id,kind,input,context,result});
      const next = [...this.history,entry];
      // Land the journal before acknowledging success. Existing entries survive.
      try {await this.store.put('foundation:journal',next);}catch(error){this.storageFault=error;throw error;}
      this.history = next;
      return result;
    });
    this.queue = operation.catch(()=>{});
    return operation;
  }
  chat(text, context={}) { return this.transact(String(text),context,'chat'); }
  runTool(command,context={}) { return this.transact(command,context,'tool'); }
  async ingest(input, context={}) {
    const a = await normalizeArtifact(input,context);
    return this.transact({name:a.name,mime:a.mime,bytes:a.bytes,content:a.text},context,'artifact');
  }
  async apply(input, context={}, kind, id) {
    if(kind==='tool') {
      const tool=this.system.engine.toolsById.get(input.tool);
      if(!tool||typeof input.source!=='string'||!input.source.trim())throw new TypeError('Mounted tool id and source provenance required');
      // Validate the complete operational coordinate before any tool mutation.
      // Donor gate assignments are tool metadata, never semantic coordinates.
      const address=input.address?parseAddress(input.address,{source:input.source}):null;
      const handoff=input.meaning?resolveFieldToolInput(this.field,input.meaning,input.input??{}):null;
      if(handoff?.status==='INVESTIGATE') {
        const receipt={tool:tool.id,source:input.source,address,status:'INVESTIGATE',handoff,reason:'The field must resolve meaning before this tool runs'};
        const fieldContact=this.field.observe({modality:'tool-result',source_ref:id,address,tool_evidence:receipt});
        return {id,ok:false,tool:receipt,fieldContact};
      }
      const saved={state:tool.exportState(),calls:tool.calls,lifecycle:tool.lifecycle};
      let run,error=null;
      try {run=tool.run(handoff?.input??input.input??{},{...context,source:id,address,dimension:address?.dimension??context.dimension,fieldMeaning:handoff?.meaning??null});}
      catch(failure){tool.hydrate(saved.state);tool.calls=saved.calls;tool.lifecycle=saved.lifecycle;error={code:failure.code??'TOOL_ERROR',message:String(failure.message??failure)};}
      const status=error?'FAILED':run.output?.ok===false?'REJECTED':run.output==null?'INVESTIGATE':'EXECUTED';
      const receipt={tool:tool.id,source:input.source,address,handoff,output:copy(run?.output??null),trace:copy(run?.trace??[]),status,error,lifecycleAccepted:run?.accepted??null,semanticTruth:'UNVERIFIED_TOOL_RESULT',traceAppearance:'DONOR_COMPUTATIONAL_METADATA'};
      const fieldContact=this.field.observe({modality:'tool-result',source_ref:id,address,observed_features:{tool:tool.id},tool_evidence:receipt});
      const shared=this.system.shareKnowledge({kind:'addressed-tool-result',receipt,observation:fieldContact.observation.id},{source:id});
      return {id,ok:receipt.status==='EXECUTED',tool:receipt,fieldContact,shared};
    }
    if(kind==='image')return this.applyImage(input,id);
    if(kind==='photo') {
      const artifact=this.photoMemory.ingest({name:input.name,content:new Uint8Array(input.bytes),mode:'binary'});
      const recovery=this.photoMemory.regenerate(artifact.id);
      const photo={id,name:input.name,mime:input.mime,artifactId:artifact.id,byteLength:recovery.bytes.length,sha256:recovery.sha256,manifest:recovery.manifest.address,kind:'exact-original-file-recovery',semanticReconstruction:false,newImageGeneration:false};
      this.photos.set(id,photo);
      const fieldContact=this.field.observe({modality:'visual',source_ref:id,observed_features:{artifact:{mime:input.mime,byteLength:photo.byteLength}},uncertainty:{sceneMeaning:'UNKNOWN',pixelAnalysis:'NOT_RUN'}});
      const shared=this.system.shareKnowledge({kind:'photo-recovery',photo},{source:'morphmir-memory'});
      return {id,ok:recovery.isExact,photo,fieldContact,shared};
    }
    if(kind==='field') {
      if(input.operation==='tool')return this.apply(input.payload,context,'tool',id);
      const result=input.operation==='dictionary'
        ? this.system.engine.toolsById.get('diseminer').run(input.payload,{source:id}).output
        : this.field.execute(input);
      const shared=this.system.shareKnowledge({kind:'document-field',entry:id,result},{source:'document-field'});
      return {id,ok:true,field:result,shared};
    }
    if(kind==='lineage') {
      const piece=await this.lineage.register(input);
      const shared=this.system.shareKnowledge({kind:'lineage',piece},{source:'lineage'});
      return {id,ok:true,piece,shared};
    }
    if(kind==='fit') {
      const consequence=this.lineage.fit(input);
      this.system.shareKnowledge({kind:'composition-consequence',consequence},{source:'lineage'});
      return {id,ok:true,consequence};
    }
    if (context.canonicalAddress) validateCanonicalAddress(context.canonicalAddress);
    const session = await this.kernel.prepare(input,context);
    // Address-first observation before the operation; execution placement follows.
    const admission = this.system.engine.intake(session.normalized.text || session.fingerprint,context);
    const outcome = await this.pipeline.execute({name:session.normalized.name,content:session.normalized.text,bytes:session.normalized.bytes,type:session.normalized.kind},{...context,foundationKind:kind});
    const execution = {...outcome,backendUsed:false,workerUsed:false};
    const record = await this.kernel.finalize(session,execution);
    const text = session.normalized.text;
    const symbol = text ? await this.klein.process(text,id) : null;
    const fiveW = symbol ? this.klein.ask5W(id) : null;
    const episode = this.ato.storeEpisode('foundation',{state:{id,fingerprint:session.fingerprint,address:record.address.id,ok:execution.ok}},1);
    const shared = this.system.shareKnowledge({kind:'ingestion',fingerprint:record.fingerprint,address:record.address,fields:record.fields,fiveW,episodeId:episode.id},{source:kind});
    const fieldContact=this.field.observe({modality:kind==='chat'?'text':'artifact',source_ref:id,observed_features:{text:text||null,mime:session.normalized.mime??null},address:context.operationalAddress??null,tool_evidence:{fiveW,executionStatus:execution.ok}});
    return {id,ok:execution.ok,admission,record,outcome,fiveW,shared,atoEpisode:episode.id,fieldContact};
  }
  async executeCore(artifact,context) {
    let outcome;
    if (context.foundationKind === 'chat') {
      outcome = await this.system.chat(artifact.content,context);
      outcome = {...outcome,kind:'chat',path:'state-space-klein-chat',result:{engine:'SynthiaSystem',stdout:[],returnValue:outcome.utterance}};
    } else {
      let spec = null;
      if (artifact.type === 'json') {
        try { const parsed=JSON.parse(artifact.content); if(parsed.realizer) spec=parsed; } catch {}
      }
      if (spec) {
        // Executable state-space specs use the spine's bounded IR/search/capabilities.
        outcome = await this.runtime.execute(spec,context.environment ?? {});
        outcome = {...outcome,kind:'state-space-spec',path:'spine-realization',result:{engine:outcome.realizer,stdout:[],returnValue:outcome.value}};
        this.system.shareKnowledge({kind:'state-space-execution',outcome},{source:'execution'});
      } else {
        outcome = await this.system.executeArtifact(artifact,context);
      }
    }
    if (!outcome.canonicalAddressKey) {
      const resolved=this.system.addressResolver.resolve({artifact,execution:outcome,decomposition:this.system.addressResolver.descend(artifact)});
      outcome={...outcome,canonicalAddress:context.canonicalAddress ?? resolved.address,canonicalAddressKey:context.canonicalAddress ? canonicalAddressKey(context.canonicalAddress):resolved.key,addressBasis:context.canonicalAddress?'creator-supplied':resolved.derivation.basis,addressDerivation:resolved.derivation};
    }
    return outcome;
  }
  tools() { return this.system.engine.listTools().map(tool=>tool.id==='diseminer'?{...tool,capabilities:['observe','extract','query'],automatonForm:'sourced dictionary adapter',policy:this.documentToolPolicy.version}:tool); }
  imageCommand(command){return this.transact(command,{},'image');}
  async analyzePhoto(photoId,options={}){
    await this.ready;
    const recovered=this.recoverPhoto(photoId);
    let frame;
    try{frame=await decodeImageBytes(recovered.bytes,recovered.photo.mime,options);}
    catch(error){return this.imageCommand({operation:'decode-failure',photoId,error:String(error.message),decoderTrace:copy(error.decoderTrace??[])});}
    return this.imageCommand({operation:'analyze',source:photoId,frame});
  }
  imageArtifact(imageId){
    const ref=this.field.semantic.refFor(imageId);let reader=this.imageMemory;
    if(ref){reader=new ImageMemory();reader.images.set(imageId,this.field.semantic.read(ref).representation);}
    const artifact=reader.artifact(imageId),saved=this.imageMemory.images.get(imageId)?.artifact;
    if(saved&&artifact.sha256!==saved.sha256)throw new Error('Reconstructed artifact differs from landed output');
    return {...artifact,location:saved?.location??null,renderSource:ref?'ADDRESSED_FIELD_REPRESENTATION':'LOCAL_IMAGE_GRAMMAR'};
  }
  async readImageArtifact(imageId){
    await this.ready;const metadata=this.imageMemory.images.get(imageId)?.artifact;if(!metadata)throw new Error('No saved image artifact');
    const artifact=await this.store.get(metadata.location);if(!artifact||sha256Hex(artifact.bytes)!==metadata.sha256)throw new Error('Saved image artifact failed integrity verification');
    return copy(artifact);
  }
  async applyImage(input,id){
    if(input.operation==='decode-failure'){
      const fieldContact=this.field.observe({modality:'visual',source_ref:input.photoId,observed_features:{},uncertainty:{pixelAnalysis:'UNAVAILABLE'},failure:{operation:'native-photo-decode',error:input.error,decoderTrace:input.decoderTrace??[]}});
      return {id,ok:false,imageFailure:{source:input.photoId,error:input.error,decoderTrace:input.decoderTrace??[]},fieldContact};
    }
    if(input.operation==='teach'){
      if(input.outcome!==undefined&&!Number.isFinite(input.outcome))throw new TypeError('Finite numeric outcome required');
      if(input.context?.dominatingStructure&&!this.field.structures.things.has(input.context.dominatingStructure))throw new TypeError('Unknown dominating structure');
      const feedback=this.imageMemory.teach(input);
      const ref=this.field.semantic.refFor(feedback.imageId);
      const semanticEvidence=ref?this.field.semantic.teach({ref,term:feedback.label,source:feedback.source,context:input.context??{}}):null;
      const dictionary=this.system.engine.toolsById.get('diseminer').run({operation:'extract',entries:[{term:feedback.label,definition:`User-supplied label for measured image ${feedback.imageId}`,source:feedback.source}]},{source:id}).output;
      const autoling=this.system.engine.toolsById.get('autoling').run({operation:'pipeline',text:feedback.label},{source:id}).output;
      const fieldExecution=input.outcome===undefined?null:this.runVisualField(feedback.imageId,input.outcome);
      return {id,ok:true,imageFeedback:feedback,semanticEvidence,dictionary,autoling,fieldExecution};
    }
    if(input.operation==='bind'){
      const image=this.imageMemory.images.get(input.imageId);if(!image||!input.provenance?.source)throw new TypeError('Stored image and explicit address provenance required');
      if(this.imageMemory.bindings.has(input.imageId))throw new Error('Image binding already landed; preserve it and bind a descendant image');
      const key=coordinateKey(input.address);
      if(input.address.dimension==='Space')throw new Error('Bind an active perspective; Space remains a derived view');
      if(!this.field.nodes.has(key))this.field.register({address:input.address,provenance:input.provenance});
      const ref=this.field.semantic.attach({coordinate:input.address,representation:{format:'image-grammar.v1',structure:image.structure,pixelSha256:image.pixelSha256},source:input.imageId,provenance:input.provenance});
      const latest=this.imageMemory.feedback.filter(f=>f.imageId===input.imageId).at(-1);
      if(latest)this.field.semantic.teach({ref,term:latest.label,source:latest.source,context:latest.context??{}});
      this.imageMemory.bindings.set(input.imageId,{address:copy(input.address),provenance:copy(input.provenance)});
      return {id,ok:true,imageBinding:{imageId:input.imageId,key,ref,provenance:input.provenance},fieldExecution:this.runVisualField(input.imageId)};
    }
    if(input.operation==='learn-program')return this.learnImageProgram(input,id);
    let image;
    const imageId=`image:${id}`;
    let construction=null;
    if(input.operation==='analyze')image=this.imageMemory.store({id:imageId,...input.frame,source:input.source});
    else if(input.operation==='compose')image=this.imageMemory.compose(input.recipe,imageId);
    else if(input.operation==='generate'){
      if(input.dominatingStructure&&!this.field.structures.things.has(input.dominatingStructure))return {id,ok:false,semantic:{status:'INVESTIGATE',reason:'Unknown dominating structure'}};
      const autoling=this.system.engine.toolsById.get('autoling').run({operation:'pipeline',text:input.terms.map(t=>typeof t==='string'?t:t.text).join('\n')},{source:id}).output;
      construction=this.field.semantic.plan(input);
      if(construction.status!=='PLANNED')return {id,ok:false,semantic:construction,autoling};
      const {template}=construction.program;
      const parts=template.slots.map((slot,i)=>({...slot,imageId:`operand:${i}`}));
      const frame=composeImage({width:template.width,height:template.height,background:template.background,parts,source:`field-program:${construction.program.name}@${construction.program.version}`},key=>construction.operands[Number(key.split(':')[1])]?.representation.structure);
      frame.lineage.parts=frame.lineage.parts.map((part,i)=>({...part,imageId:construction.operands[i].source,stateRef:copy(construction.address.operands[i])}));
      image=this.imageMemory.store({id:imageId,...frame,source:frame.lineage.source,lineage:frame.lineage});
      const landedState=this.field.semantic.land({plan:construction,representation:{format:'image-grammar.v1',structure:this.imageMemory.images.get(imageId).structure,pixelSha256:image.pixelSha256},source:imageId,provenance:{source:input.source??id,calculation:'learned-addressed-construction.v1'}});
      this.imageMemory.images.get(imageId).fieldAddress=landedState.address;
      construction={...construction,...landedState,autoling,renderSource:'ADDRESSED_FIELD_REPRESENTATIONS'};
    }
    else throw new TypeError('Unknown image operation');
    // Content-addressed artifact storage is integrity bookkeeping, not meaning.
    // An unacknowledged orphan from a failed journal write cannot block a new
    // image at the next event ID or overwrite a differently encoded artifact.
    const artifact=this.imageMemory.artifact(imageId),location=`foundation:image-artifact:${imageId}:${artifact.sha256}`;
    const landed=await this.store.get(location);
    if(landed&&sha256Hex(landed.bytes)!==landed.sha256)throw new Error('Landed image artifact is corrupt; original is not overwritten');
    if(landed&&landed.sha256!==artifact.sha256)throw new Error('Landed artifact differs from replay; a versioned migration is required');
    if(!landed)try{await this.store.put(location,{...artifact,location});}catch(error){this.storageFault=error;throw error;}
    this.imageMemory.images.get(imageId).artifact={location,sha256:artifact.sha256,byteLength:artifact.bytes.length,mime:artifact.mime,alphaPolicy:artifact.alphaPolicy};
    image=this.imageMemory.summary(imageId);
    const frame=this.imageMemory.reconstruct(imageId),sensory=this.visualSensory.observe({id:imageId,...frame,measurements:image.measurements});
    const dictionary=this.system.engine.toolsById.get('diseminer').run({operation:'observe',observation:{source_ref:imageId,modality:'visual',observed_features:{sensory,measurements:image.measurements}}},{source:id}).output;
    const fieldContact=this.field.observe({modality:'visual',source_ref:imageId,observed_features:{visual:{measurements:image.measurements,sensory,structureRef:imageId}},relation_edges:image.lineage?.parts.map(p=>({subject:p.imageId,predicate:'contributed-pixels-to',object:imageId,source:image.lineage.source}))??[],uncertainty:{sceneMeaning:'UNKNOWN',ontologicalAddress:construction?'LEARNED_RECURSIVE_CONSTRUCTION':'UNRESOLVED'}});
    const recognition=this.imageMemory.recognize(imageId),fieldExecution=construction?this.runConstructionField(construction,imageId):this.runVisualField(imageId);
    const shared=this.system.shareKnowledge({kind:'measured-visual-contact',image,sensory,recognition,fieldExecution},{source:'image-grammar.v1'});
    return {id,ok:true,image,construction,recognition,dictionary,fieldContact,fieldExecution,shared};
  }
  learnImageProgram(input,id){
    const example=this.imageMemory.images.get(input.imageId),parts=example?.lineage?.parts;
    if(!parts?.length)return {id,ok:false,semantic:{status:'INVESTIGATE',reason:'Choose an observed composition to learn its construction'}};
    const refs=parts.map(p=>p.stateRef??this.field.semantic.refFor(p.imageId));
    if(refs.some(r=>!r))return {id,ok:false,semantic:{status:'INVESTIGATE',reason:'Source constituents need sourced address bindings',sources:parts.filter((p,i)=>!refs[i]).map(p=>p.imageId)}};
    const slots=parts.map((part,i)=>{
      const record=this.field.semantic.read(refs[i]),structure=record.representation.structure;
      if(part.node!==undefined&&part.node!==structure.root)throw new Error('Sub-part transfer requires a learned correspondence; whole-constituent examples are supported');
      const crop=part.crop??{width:structure.width,height:structure.height},odd=(part.quarterTurns??0)%2;
      return {x:part.x,y:part.y,width:part.width??(odd?crop.height:crop.width),height:part.height??(odd?crop.width:crop.height),...(part.crop?{crop:copy(part.crop)}:{}),quarterTurns:part.quarterTurns??0,flipX:part.flipX??false,flipY:part.flipY??false};
    });
    const owner=input.owner??this.field.semantic.refFor(input.imageId)??refs[0];
    const program=this.field.semantic.learnProgram({name:input.name,owner,template:{width:example.width,height:example.height,background:example.lineage.background,slots},source:input.source,evidence:[{image:input.imageId,pixelSha256:example.pixelSha256,constituents:refs,governingPrimitive:owner,basis:'Observed composition; leading qualified primitive (document Rules §8) unless explicit owner supplied'}]});
    return {id,ok:true,semanticProgram:program};
  }
  runConstructionField(construction,imageId){
    const coordinates=construction.address.operands.map(ref=>this.field.semantic.owner(ref));
    const image=this.imageMemory.images.get(imageId);
    const run=this.field.execute({operation:'run',payload:{candidates:coordinates,input:image.structure.measurements.fieldInput,tier:5,budgets:[1,4,8,16,64],provenance:{source:imageId,calculation:'sourced-semantic-evidence.v1',program:construction.address.program},context:{modality:'visual',addressedConstruction:construction.address}}});
    return {selection:{method:'RESOLVED_SEMANTIC_OPERANDS',operands:copy(construction.address.operands)},run};
  }
  runVisualField(imageId,feedback){
    const image=this.imageMemory.images.get(imageId),descriptor=image.structure.measurements.descriptor;
    const candidates=[...this.imageMemory.bindings].map(([source,binding])=>{
      const other=this.imageMemory.images.get(source).structure.measurements.descriptor;
      const distance=Math.sqrt(descriptor.reduce((s,v,i)=>s+(v-other[i])**2,0)/descriptor.length);
      return {source,...binding,distance};
    }).sort((a,b)=>a.distance-b.distance||a.source.localeCompare(b.source));
    if(!candidates.length)return {status:'INVESTIGATE',reason:'No explicitly sourced visual-to-address binding exists'};
    const selected=candidates[0];
    const run=this.field.execute({operation:'run',payload:{candidates:[selected.address],input:image.structure.measurements.fieldInput,feedback,provenance:{source:imageId,calculation:'measured-visual-distance.v1',bindingSource:selected.source,bindingProvenance:selected.provenance},context:{modality:'visual',source:imageId}}});
    return {selection:{method:'measured-visual-distance.v1',source:selected.source,distance:selected.distance,status:'ENGINEERING_HYPOTHESIS'},run};
  }
  async storePhoto(file) {
    const bytes=file.bytes instanceof Uint8Array?file.bytes:new Uint8Array(await file.arrayBuffer());
    const mime=file.type??file.mime;
    if(!['image/png','image/jpeg','image/bmp','image/gif','image/webp'].includes(mime))throw new TypeError('Select a supported photo file');
    // This is byte recovery, not a claim of decoding/understanding these formats.
    return this.transact({name:file.name,mime,bytes},{},'photo');
  }
  recoverPhoto(id) {
    const photo=this.photos.get(id);if(!photo)throw new Error('Photo not found');
    return {photo:copy(photo),...this.photoMemory.regenerate(photo.artifactId)};
  }
  fieldCommand(command) {
    if(typeof command?.operation==='string'&&command.operation.startsWith('image:'))return this.imageCommand({...command.payload,operation:command.operation.slice(6)});
    return this.transact(command,{},'field');
  }
  registerPiece(piece) {return this.transact(piece,{},'lineage');}
  fitPieces(contract) {return this.transact(contract,{},'fit');}
  toolWiringAudit() {
    const observations=this.field.observations.filter(o=>o.modality==='tool-result');
    return {schema:'synthia.tool-field-wiring.v1',tools:this.tools().map(tool=>{
      const receipts=observations.filter(o=>o.tool_evidence?.tool===tool.id);
      return {id:tool.id,mounted:this.system.engine.toolsById.has(tool.id),capabilities:tool.capabilities,fieldReceiptCount:receipts.length,lastStatus:receipts.at(-1)?.tool_evidence.status??'NOT_EXERCISED',addressBasis:'SUPPLIED_COORDINATE_ONLY'};
    }),meaningStatus:'SOURCED_CONTEXTUAL_RESOLUTION',generalUnderstandingVerified:false,automaticSemanticRoutingVerified:false};
  }
  audit() {
    return {toolWiring:this.toolWiringAudit(),system:this.system.wiringAudit(),pipeline:this.pipeline.wiringAudit(),klein:this.klein.getStats(),toolPolicy:this.documentToolPolicy.audit(),ato:this.ato.getStats(),field:this.field.audit(),visual:{images:this.imageMemory.images.size,taughtExamples:this.imageMemory.feedback.length,explicitBindings:this.imageMemory.bindings.size,sensoryAdapter:'measured-visual-sensory.v1',semanticObjectRecognitionVerified:false},legacyAddressing:{status:'COMPUTATIONAL_BOOKKEEPING',semanticDerivationVerified:false},entries:this.history.length,backendRequired:false,workerRequired:false,modelRequired:false};
  }
  export() { return copy({schema:'synthia.foundation.journal.v1',entries:this.history}); }
}
