import path from 'node:path';import {fileURLToPath} from 'node:url';
import {normalizeAddress} from './core/address.mjs';import {ChannelRegistry} from './registries/channel-registry.mjs';import {RuleRegistry,installCoreRules} from './registries/rule-registry.mjs';import {ExtensionRegistry} from './extensions/registry.mjs';import {MorphologyCompiler} from './graph/morphology-compiler.mjs';import {ConnectionCompiler} from './graph/connection-compiler.mjs';import {GraphRuntime} from './graph/graph-runtime.mjs';import {GraphEcology} from './graph/ecology.mjs';import {GraphWeightStore} from './graph/weight-store.mjs';import {projectGraph} from './projections/multimodal.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');
export class GenerativeAddressMorphologyEngine{
  constructor(options={}){
    this.extensions=new ExtensionRegistry();this.channels=ChannelRegistry.fromFile(options.channelsPath??path.join(root,'config/channels.json'));
    this.rules=installCoreRules(new RuleRegistry());this.morphology=new MorphologyCompiler({extensions:this.extensions});this.compiler=new ConnectionCompiler({channels:this.channels,rules:this.rules,morphology:this.morphology});
    const weightsFile=Object.prototype.hasOwnProperty.call(options,'weightsFile')?options.weightsFile:path.join(root,'state','graph-weights.json');this.weights=new GraphWeightStore(weightsFile);this.runtime=new GraphRuntime({weights:this.weights});
    this.ecology=new GraphEcology(options.ecologyConfig??{coverageWeight:.55,expressionWeight:.30,persistenceWeight:.15});this.addresses=new Map();this.last=null;
  }
  registerRule(rule){return this.rules.register(rule);}
  registerMorphology(channelId,fn,meta){return this.extensions.register('morphology',channelId,fn,meta);}
  run(rawAddresses=[],context={}){
    const addresses=rawAddresses.map(normalizeAddress);this.addresses=new Map(addresses.map(a=>[a.id,a]));const connections=this.compiler.compileAll(addresses,context);
    const activeIds=new Set(addresses.filter(a=>a.active).map(a=>a.id));const graphs=this.runtime.update(connections,activeIds);const ecology=this.ecology.evaluate(graphs,addresses.filter(a=>a.active));const projections=Object.fromEntries(graphs.map(g=>[g.id,projectGraph(g)]));
    this.last={ok:true,at:Date.now(),addresses,connections:connections.map(c=>({id:c.id,a:c.a.id,b:c.b.id,channel:c.channel,validity:c.validity,audit:c.audit,morphology:{id:c.morphology.id,implementation:c.morphology.implementation,evidenceStatus:c.morphology.evidenceStatus}})),graphs,ecology,projections};return this.last;
  }
  reinforce(graphId,delta,outcome=null){return this.weights.reinforceExisting(graphId,delta,outcome);}
  snapshot(){return this.last??{ok:true,addresses:[],connections:[],graphs:this.runtime.active(),ecology:{dominantEnergy:null,energies:[],pods:[]},projections:{}};}
}
export default GenerativeAddressMorphologyEngine;
