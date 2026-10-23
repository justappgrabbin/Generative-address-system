import {parseAddress,serializeAddress,compareAddresses,evaluateTransition,PERSPECTIVES} from './operational-address.mjs';
import {TrainableComponent} from './trainable-component.mjs';
import {SemanticState} from './semantic-state.mjs';
import {StructuralFrames} from './structural-frames.mjs';
import {resolveProportionalAddress} from './proportional-position.mjs';
const clone=structuredClone;
// Perspective is a view of the same occupied coordinates, not a second identity.
export function coordinateKey(address){const a=JSON.parse(serializeAddress(address));delete a.dimension;return JSON.stringify(a);}
export class AddressedField {
  constructor(){this.nodes=new Map();this.edges=[];this.runs=[];this.compositions=[];this.observations=[];this.rules=new Map();this.semantic=new SemanticState();this.structures=new StructuralFrames();}
  register({address,provenance}){
    address=parseAddress(address,provenance);
    if(!provenance?.source)throw new TypeError('Component registration requires source provenance');
    if(address.dimension==='Space')throw new TypeError('Space is an emergent readout, not a fifth trainable peer');
    const key=coordinateKey(address);
    if(this.nodes.has(key))throw new Error('Occupied coordinate: existing state must be retained; use another state or a perspective view');
    this.nodes.set(key,{address,provenance:clone(provenance),component:new TrainableComponent()});
    return {key,address,provenance:clone(provenance)};
  }
  observe(event){
    if(!event?.modality||!event.source_ref)throw new TypeError('Contact requires modality and source_ref');
    const observation=clone({...event,id:`observation:${this.observations.length+1}`});
    // Missing sensor data stays absent/UNKNOWN. Never synthesize it from words.
    this.observations.push(observation);
    return {observation,status:'INVESTIGATE',reason:event.address?'Awaiting evidence-grounded component selection':'No source-derived address supplied',missingModalities:['audio','gesture','visual'].filter(m=>m!==event.modality&&!event.observed_features?.[m]).map(modality=>({modality,status:'UNKNOWN'}))};
  }
  installRule(rule){
    if(!rule?.version||!rule.source||!rule.encodings)throw new TypeError('Versioned source-backed transition encodings required');
    if(this.rules.has(rule.version))throw new Error('Rule version already landed');
    this.rules.set(rule.version,clone(rule));return {version:rule.version,source:rule.source};
  }
  run({candidates,input,tier=1,budgets=[1,2,4,8,16],ruleVersion,feedback,provenance,context={}}){
    if(!provenance?.source||!Array.isArray(candidates)||!candidates.length)throw new TypeError('Execution requires sourced candidate addresses');
    if(!Array.isArray(input)||input.length!==2||!input.every(Number.isFinite))throw new TypeError('Two finite observed numeric features required; no implicit text embedding');
    if(!Number.isInteger(tier)||tier<1||tier>5||budgets.length!==5||!budgets.every(n=>Number.isInteger(n)&&n>0))throw new RangeError('Five positive tier budgets required');
    if(feedback!==undefined&&!Number.isFinite(feedback))throw new TypeError('Finite outcome feedback required');
    const requested=[...new Set(candidates.map(a=>coordinateKey(parseAddress(a))))];
    const unknown=requested.filter(key=>!this.nodes.has(key));
    if(unknown.length)return {status:'INVESTIGATE',reason:'Unoccupied candidate addresses require grounded registration',unknown};
    const selected=requested.slice(0,budgets[tier-1]);
    const initial=selected.map(key=>this.nodes.get(key).component.forward(input).value);
    const rule=this.rules.get(ruleVersion),id=`field-run:${this.runs.length+1}`,messages=[],micro=[],newEdges=[];
    const trace=[{stage:'Observe',input:clone(input),provenance:clone(provenance)},{stage:'Interpret',candidates:requested},{stage:'Investigate',operation:'retrieve-registered-components',retrieved:selected,unresolved:['center-emergence','birth-to-address','contextual-DMSA-CTB'] }];
    // Directed coactivity is witnessed only during execution. Reference tables
    // alone cannot create an edge, and each changed level is checked separately.
    for(let i=0;i<selected.length;i++){
      const key=selected[i],node=this.nodes.get(key);
      let message=0;
      // One synchronous round: candidate listing order is not causal evidence.
      for(let j=0;j<selected.length;j++){
        if(j===i)continue;
        const from=selected[j],source=this.nodes.get(from),decision=evaluateTransition(source.address,node.address,rule);
        if(decision.status!=='PERMITTED'){messages.push({from,to:key,status:decision.status,decision});continue;}
        const packet={type:'field.activation.v1',from,to:key,value:initial[j],run:id};
        message+=packet.value;messages.push({status:'DELIVERED',packet,decision});
        const edge={source:from,relation:'observed-coactivity',target:key,address:clone(node.address),dimension:node.address.dimension,transformation:clone(decision),context:clone(context),provenance:clone(provenance),run:id};
        newEdges.push(edge);
      }
      const value=node.component.forward(input,{message}).value;
      micro.push({key,dimension:node.address.dimension,gate:node.address.gate,value,message,parameterVersion:node.component.version,reason:'Explicit evidence candidate within tier budget'});
    }
    const learned=feedback===undefined?[]:micro.map(({key,message})=>({key,...this.nodes.get(key).component.update(input,feedback,{message})}));
    this.edges.push(...newEdges);
    // Aggregation is an explicit engineering operation, not an invented
    // assignment to one of nine centers. Those remain unresolved.
    const meso=[...new Set(micro.map(n=>n.dimension))].map(dimension=>({dimension,value:micro.filter(n=>n.dimension===dimension).reduce((s,n)=>s+n.value,0)/micro.filter(n=>n.dimension===dimension).length}));
    const space={kind:'derived-shared-field-readout',contributors:micro.map(n=>n.key),value:micro.reduce((s,n)=>s+n.value,0)/micro.length,centerStatus:'INVESTIGATE'};
    trace.push({stage:'Verify',messages:clone(messages),active:selected.length},{stage:'Adapt',feedback:feedback??null},{stage:'Learn',changes:clone(learned)});
    const result={id,status:'EXECUTED',tier,ruleVersion:ruleVersion??null,micro,meso,macro:space.value,Space:space,messages,learned,trace,metrics:{activeComponents:selected.length,registeredComponents:this.nodes.size,newEdges:newEdges.length,parameterUpdates:learned.length},provenance:clone(provenance)};
    this.runs.push(clone(result));return clone(result);
  }
  compose({children,operator,provenance,context={}}){
    if(!Array.isArray(children)||!children.length||!provenance?.source)throw new TypeError('Composition requires children and source');
    const ids=new Set([...this.nodes.keys(),...this.compositions.map(c=>c.id)]);
    if(children.some(c=>!ids.has(c)))throw new Error('Unknown constituent');
    if(operator!=='ordered-composition')throw new Error('Unregistered composition operator');
    const result={id:`composition:${this.compositions.length+1}`,operator,children:clone(children),context:clone(context),provenance:clone(provenance)};
    this.compositions.push(result);return clone(result);
  }
  transfer({from,to,ruleVersion,provenance}){
    const source=this.nodes.get(coordinateKey(from)),target=this.nodes.get(coordinateKey(to));
    if(!source||!target||source===target||!provenance?.source)throw new TypeError('Two registered components and explicit transfer provenance required');
    const decision=evaluateTransition(source.address,target.address,this.rules.get(ruleVersion));
    if(decision.status!=='PERMITTED')return {status:decision.status,decision};
    const before=target.component.snapshot(),learned=source.component.snapshot();
    target.component.restore({...learned,version:before.version+1});
    return {status:'TRANSFERRED',from:coordinateKey(from),to:coordinateKey(to),sourceVersion:learned.version,before,after:target.component.snapshot(),decision,provenance:clone(provenance)};
  }
  view(address,dimension){
    if(!PERSPECTIVES.includes(dimension))throw new TypeError('Unknown perspective');
    const key=coordinateKey(address),node=this.nodes.get(key);
    if(!node)throw new Error('Unoccupied coordinate');
    return {key,perspective:dimension,address:clone(node.address),parameters:node.component.snapshot(),representationStatus:'INVESTIGATE',reason:'Perspective-specific transformation rule not yet supplied'};
  }
  slots({dimension}){
    if(!PERSPECTIVES.includes(dimension))throw new TypeError('Unknown perspective');
    const active=this.runs.at(-1)?.micro??[];
    const slots=Array.from({length:64},(_,i)=>({gate:i+1,occupants:[...this.nodes].filter(([,n])=>n.address.gate===i+1).map(([key])=>key),active:active.filter(n=>n.gate===i+1&&(dimension==='Space'||n.dimension===dimension)).map(n=>({key:n.key,value:n.value}))}));
    const mask=slots.reduce((bits,s)=>s.active.length?bits|(1n<<BigInt(s.gate-1)):bits,0n).toString(16).padStart(16,'0');
    return {dimension,kind:dimension==='Space'?'derived-view':'perspective-view',slots,activationMaskHex:mask,encoding:'64 slot-occupancy bits, separate from six-line codes and parameters'};
  }
  defineStructure(payload){return this.structures.define(payload);}
  attachRepresentation(payload){return this.semantic.attach(payload);}
  teachMeaning(payload){
    if(payload.context?.dominatingStructure&&!this.structures.things.has(payload.context.dominatingStructure))throw new TypeError('Unknown dominating structure');
    return this.semantic.teach(payload);
  }
  resolveMeaning({terms,dimension,dominatingStructure}={}){
    if(dominatingStructure&&!this.structures.things.has(dominatingStructure))return {status:'INVESTIGATE',reason:'Unknown dominating structure',dominatingStructure};
    const resolution=this.semantic.resolve(terms,{dimension,dominatingStructure});
    if(resolution.status!=='RESOLVED')return {status:'INVESTIGATE',resolution};
    const frame=dominatingStructure?this.structures.enter({id:dominatingStructure}):null;
    return {status:'RESOLVED',resolution,frame,operands:resolution.matches.map(match=>({term:match.term,teaching:match.selected,state:this.semantic.read(match.selected.ref)}))};
  }
  placeStructure(payload){return this.structures.place(payload);}
  readStructure(payload){return this.structures.read(payload);}
  enterStructure(payload){return this.structures.enter(payload);}
  resolveAddress(payload){
    const resolved=resolveProportionalAddress(payload);
    if(payload.admit)resolved.registration=this.register({address:resolved.address,provenance:{source:payload.source,calculation:resolved.calculation}});
    return resolved;
  }
  execute(command){
    const mutatesMeaning=['attachRepresentation','teachMeaning'].includes(command?.operation);
    const semantic=this.semantic,before=this.snapshot({includeSemantic:mutatesMeaning});
    try {
      if(!['register','observe','installRule','run','compose','transfer','view','slots','resolveAddress','defineStructure','placeStructure','readStructure','enterStructure','resolveMeaning','attachRepresentation','teachMeaning'].includes(command?.operation))throw new TypeError('Unknown field operation');
      if(command.operation==='view')return this.view(command.address,command.dimension);
      return this[command.operation](command.payload);
    }catch(error){this.restore(before);if(!mutatesMeaning)this.semantic=semantic;throw error;}
  }
  snapshot({includeSemantic=true}={}){return clone({schema:'synthia.addressed-field.v1',nodes:[...this.nodes].map(([key,n])=>[key,{...n,component:n.component.snapshot()}]),edges:this.edges,runs:this.runs,compositions:this.compositions,observations:this.observations,rules:[...this.rules],structures:this.structures.snapshot(),semantic:includeSemantic?this.semantic.snapshot():null});}
  restore(s){
    if(s?.schema!=='synthia.addressed-field.v1')throw new TypeError('Unsupported field snapshot');
    const nodes=new Map(s.nodes.map(([key,n])=>{if(coordinateKey(n.address)!==key)throw new TypeError('Snapshot address mismatch');return [key,{...clone(n),component:new TrainableComponent(n.component)}];}));
    this.nodes=nodes;this.edges=clone(s.edges);this.runs=clone(s.runs);this.compositions=clone(s.compositions);this.observations=clone(s.observations);this.rules=new Map(clone(s.rules));this.semantic=new SemanticState(s.semantic);this.structures=new StructuralFrames(s.structures);return this;
  }
  audit(){return {schema:'synthia.addressed-field.v1',slots:Object.fromEntries(PERSPECTIVES.map(d=>[d,{available:64,kind:d==='Space'?'derived-view':'perspective-view'}])),components:this.nodes.size,edges:this.edges.length,runs:this.runs.length,compositions:this.compositions.length,observations:this.observations.length,rules:[...this.rules.keys()],externalModelRequired:false,gpuRequired:false,unknown:['birth-to-address','nine-center-reference-selection','arc-to-color-sound','dimension-specific-CTB-DMS-alignment','Base-sharing','Bantu-language-rule-pack','four-Model-Maker-positions']};}
}
