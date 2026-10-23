import {parseAddress,PERSPECTIVES,serializeAddress} from './operational-address.mjs';
import {coordinateKey} from './addressed-field.mjs';
import {DimensionPerspectiveRegistry} from '../vendor/organism/src/state-space/dimension-perspective-registry.mjs';
import {GateArchitectureProvider} from '../vendor/organism/src/state-space/gate-architecture-provider.mjs';
import {DnaStateSubstrate,structuralNeuralVector} from '../vendor/organism/src/state-space/dna-state-substrate.mjs';
import {DnaPerceptionRuntime} from '../vendor/organism/src/state-space/dna-perception-runtime.mjs';
import {MovementTransportRuntime} from '../vendor/organism/src/state-space/movement-transport-runtime.mjs';
import {TemporalExperienceRuntime} from '../vendor/organism/src/state-space/temporal-experience-runtime.mjs';
import {BiologicalTranslationRuntime} from '../vendor/organism/src/state-space/biological-translation-runtime.mjs';
import {CanonicalMorphRuntime} from '../vendor/organism/src/morph/canonical-morph-runtime.mjs';
import {AddressedPictureMemory} from '../vendor/addressed-picture-memory.mjs';
import {GenerativeTraceMemory,LAYERS} from '../vendor/predictive-memory/vqvae-generative-memory.mjs';
import {PredictiveMemoryLoop,LearnedRelationMesh} from '../vendor/predictive-memory/predictive-semantic-learning.mjs';

const copy=structuredClone;
// A named compatibility view of the same 0–99 coordinate. It never calls the
// donor normalizer (which seeds missing address fields from a hash).
export function sourceAddress(value){
  if(value?.arc!==undefined&&value?.arcFraction!==undefined&&value.arc!==value.arcFraction)throw new TypeError('Conflicting arc and arcFraction');
  const address=parseAddress({...value,arcFraction:value?.arcFraction??value?.arc});
  const {arcFraction,...rest}=address;
  return {...rest,arc:arcFraction};
}
function operational(value){const a=sourceAddress(value);const {arc,...rest}=a;return {...rest,arcFraction:arc};}
function categorical(value,{partial=false}={}){
  if(!partial)sourceAddress(value);
  const input={...value,arc:value.arc??value.arcFraction},out={};
  for(const {name,k} of LAYERS){
    if(input[name]===undefined&&partial)continue;
    const n=name==='dimension'?PERSPECTIVES.indexOf(input[name]):input[name]-( ['degree','minute','second','arc'].includes(name)?0:1 );
    if(!Number.isInteger(n)||n<0||n>=k)throw new RangeError(`Invalid prediction coordinate ${name}`);
    out[name]=n;
  }
  return out;
}
function uncategorical(value){return Object.fromEntries(LAYERS.map(({name})=>[name,name==='dimension'?PERSPECTIVES[value[name]]:value[name]+(['degree','minute','second','arc'].includes(name)?0:1)]));}
function seeded(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}

/** Source mechanisms attached to the existing field, observation history and
 * shared mesh. No second state space, chart generator or resolver is created. */
export class SourceStateIntegration {
  constructor(host){
    this.host=host;
    this.perspectives=new DimensionPerspectiveRegistry();
    this.architecture=new GateArchitectureProvider();
    this.substrate=new DnaStateSubstrate({dimensionPerspectives:this.perspectives,gateArchitecture:this.architecture});
    this.perception=new DnaPerceptionRuntime();
    this.movement=new MovementTransportRuntime();
    this.temporal=new TemporalExperienceRuntime();
    this.translation=new BiologicalTranslationRuntime();
    this.morph=new CanonicalMorphRuntime({dnaPerception:this.perception});
    this.activations=new Map(); // receipts only; addressed data lives in host.field
    const view={get:key=>this.pictureState(key),resolveGate:({color,tone,base})=>{
      const gates=new Set([...host.field.nodes.values()].filter(n=>n.address.color===color&&n.address.tone===tone&&n.address.base===base).map(n=>n.address.gate));
      return gates.size===1?[...gates][0]:null;
    }};
    this.pictures=new AddressedPictureMemory(view);
    this.clock=0;
    const now=()=>this.clock;
    this.prediction=new PredictiveMemoryLoop({memory:new GenerativeTraceMemory({random:seeded(1),now}),relationMesh:new LearnedRelationMesh({now}),now});
  }
  pictureState(key){
    // The donor's serialization is a view over occupied host coordinates.
    for(const node of this.host.field.nodes.values())if(this.pictureKey(node.address)===key)return {address:copy(node.address),parameters:node.component.snapshot(),provenance:copy(node.provenance)};
    return null;
  }
  pictureKey(a){const b=operational(a);return ['planetary','dimension','gate','line','color','tone','base','degree','minute','second','arcFraction','zodiac','house'].map(k=>String(b[k])).join('|');}
  activation(ref){const a=this.activations.get(ref);if(!a)throw new Error('Unknown resolved state receipt');return a;}
  resolve(p,id){
    const address=sourceAddress(p.address),origin=p.originAddress?sourceAddress(p.originAddress):address;
    const resolved=this.substrate.resolve({address,originAddress:origin,context:{...p.context,source:p.source}});
    // Retain the full named coordinate as identity, rather than the donor's
    // short hash. Original source identity remains traceable in provenance.
    const named=`state:${serializeAddress(operational(origin))}=>${serializeAddress(operational(address))}`;
    const state={...resolved,stateId:named};
    const translation=this.translation.translateActivation({agentId:p.agentId??'local',sourceActivationId:id,resolvedState:state,address,context:{source:p.source}});
    const movementTransport=address.dimension==='Movement'?this.movement.transportGate(address.gate,{direction:p.direction??'up',sourceStateId:named}):null;
    const activation={id,agentId:p.agentId??'local',address,resolvedState:state,structuralVector:structuralNeuralVector(address),translation,movementTransport};
    const coord=operational(address);
    if(address.dimension!=='Space'&&!this.host.field.nodes.has(coordinateKey(coord)))this.host.field.register({address:coord,provenance:{source:p.source}});
    this.activations.set(id,activation);
    this.perception.enqueueActivation(activation);this.morph.observeActivation(activation);
    return activation;
  }
  async execute(operation,p={},id){
    if(typeof p.source!=='string'||!p.source.trim())throw new TypeError('State integration requires source provenance');
    this.clock=Number(id.split(':').at(-1));
    let result;
    if(operation==='resolve')result=this.resolve(p,id);
    else if(operation==='perspective')result=this.perspectives.project(p.observer,p.subject);
    else if(operation==='relate'){
      const left=this.activation(p.left),right=this.activation(p.right);
      const relationshipState=this.substrate.relate(left.resolvedState,right.resolvedState,{...p.context,source:p.source});
      const translationRelation=this.translation.relate(left.translation,right.translation,{source:p.source});
      result={relationshipState,translationRelation};
      this.perception.enqueueRelationship(result);this.morph.observeRelationship(result);
      this.host.field.edges.push({source:p.left,target:p.right,relation:'source-relational-state',relationship:copy(relationshipState),provenance:{source:p.source},entry:id});
    }else if(operation==='movement')result=p.gate?this.movement.transportGate(p.gate,p.options):this.movement.transport(p.value,p.options);
    else if(operation==='visit'){
      const a=this.activation(p.activation);
      result=this.temporal.land({agentId:a.agentId,coordinate:p.coordinate,targetResolvedState:a.resolvedState,currentState:a,relationshipIds:p.relationshipIds??[],context:{source:p.source}});
    }else if(operation==='superimpose'){
      const a=this.activation(p.activation);
      result=this.temporal.superimpose({agentId:a.agentId,currentState:a,coordinates:p.coordinates??[],historicalStateIds:p.historicalStateIds??[],context:{source:p.source}});
      this.perception.enqueueTemporalSuperposition(result);this.morph.observeTemporalSuperposition(result);
    }else if(operation==='picture'){
      result=this.pictures.capture({id:p.id??id,observedAt:this.clock,members:p.members.map(m=>({...m,address:operational(m.address??m)})),relations:p.relations??[],frame:p.frame??{}});
    }else if(operation==='recall-picture')result=this.pictures.recall(p.id);
    else if(operation==='train-prediction'){
      if(!Array.isArray(p.addresses)||!p.addresses.length||p.addresses.length>64)throw new RangeError('Supply 1–64 observed addresses');
      const epochs=p.epochs??10;
      if(!Number.isInteger(epochs)||epochs<1||epochs>100)throw new RangeError('Prediction epochs must be 1–100');
      const coords=p.addresses.map(a=>categorical(a));
      result=this.prediction.memory.train(coords,{vqEpochs:epochs,completionEpochs:epochs});
    }else if(operation==='remember')result=this.prediction.rememberExperience({id,coordinate:categorical(p.address),address:sourceAddress(p.address),outcome:p.outcome,nextCoordinate:p.nextAddress?categorical(p.nextAddress):null,evidence:[{source:p.source}]});
    else if(operation==='predict'){
      const prediction=this.prediction.predict(categorical(p.cue,{partial:true}));
      result={...prediction,address:uncategorical(prediction.predictedCoordinate),nextAddress:prediction.predictedNextCoordinate?uncategorical(prediction.predictedNextCoordinate):null};
    }else if(operation==='resolve-prediction')result=this.prediction.resolve(p.predictionId,{coordinate:p.address?categorical(p.address):null,...(Object.hasOwn(p,'outcome')?{outcome:p.outcome}:{}),evidence:{source:p.source}});
    else if(operation==='morph')result=await this.morph.execute({...p,activation:this.activation(p.activation)});
    else throw new TypeError(`Unknown state integration operation ${operation}`);
    await this.perception.flush();
    return copy(result);
  }
  audit(){return {connected:true,sharedField:true,duplicateStateSpace:false,degreeRange:[0,29],syntheticChartFillerUsed:false,resolvedReceipts:this.activations.size,pictures:this.pictures.list().length,perception:this.perception.snapshot(),temporal:this.temporal.snapshot(),prediction:{traces:this.prediction.memory.traces.length,open:[...this.prediction.predictions.values()].filter(p=>p.status!=='resolved').length}};}
}
