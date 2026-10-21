export class CynthiaBridge{
  constructor(engine,{targetId='address-morphology-engine'}={}){this.engine=engine;this.targetId=targetId;this.unit=null;}
  attach(unit){
    if(!unit?.bus?.register)throw new TypeError('Expected intact SynthiaUnit with MCPBus');
    this.unit=unit;
    unit.bus.register({kind:'thing',id:this.targetId},async message=>this.handle(message));
    if(unit.fabric?.registerExternalProcess)unit.fabric.registerExternalProcess({id:`process:${this.targetId}`,role:'generative-address-morphology',members:['address','connect','instantiate-graph','evaluate-ecology','project'],origin:{type:'additive-integration',source:'Synthia-Generative-Address-Morphology-Engine-v0.1.0'}});
    return {attached:true,target:{kind:'thing',id:this.targetId}};
  }
  async handle(message){const intent=message?.intent??message?.input??'';const options=message?.options??{};if(options.addresses)return this.engine.run(options.addresses,options.context??{});return {ok:true,engine:'Synthia Generative Address & Morphology Engine',intent:String(intent),snapshot:this.engine.snapshot(),hint:'Send options.addresses to compile addressed structure.'};}
}
