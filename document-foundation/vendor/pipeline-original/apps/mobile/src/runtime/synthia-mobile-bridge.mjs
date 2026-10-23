import { BrowserLearningCore } from './browser-learning-core.mjs';
import { calculateResearchChart, calculateHumanDesign, toStellarInput, capabilities as HD_CAPABILITIES } from '../../../../packages/human-design-research/src/index.mjs';
import { SynthiaSystem } from '../../../../packages/execution-spine/src/synthia-system.mjs';

const DIMENSION_VOICE={movement:'I Create',evolution:'I Remember',being:'I Am',design:'I Design',space:'I Think'};
function toMobileAddress(address={}){
 return {
  planetary:address.planetary??null,dimension:address.dimension??null,gate:address.gate??null,line:address.line??null,
  color:address.color??null,tone:address.tone??null,base:address.base??null,degree:address.degree??null,minute:address.minute??null,
  second:address.second??null,arc:address.arcAxis?.arcUnit??address.arc??null,zodiac:address.zodiac??null,house:address.house??null
 };
}

export function createSynthiaMobileBridge({userId='default',birthData=null,executionSystem=null}={}){
 const core=new BrowserLearningCore(`synthia-unified:${userId}`);
 const runtime=executionSystem??new SynthiaSystem();
 core.ensure('synthia',{entityType:'agent',source:{system:'Synthia-Unified-Live-v0.5.0'},state:{online:true,mode:'mobile',mandatoryCognition:['state-space','ATO','Klein']}});
 let chartBundle=null, verifiedChart=null;
 function setBirthData(data){
   birthData=data; const when=data?.date instanceof Date?data.date:new Date(data?.datetime||data?.date);
   try{chartBundle=calculateResearchChart(when,{lat:data?.lat??0,lon:data?.lon??0});}catch{chartBundle=null;}
   try{verifiedChart=calculateHumanDesign(data);}catch{verifiedChart=null;}
   return {research:chartBundle,verified:verifiedChart};
 }
 if(birthData)setBirthData(birthData);
 function firstPlacement(){return chartBundle?.frames?.tropical?.placements?.[0]||null;}
 function composeStateSentence(layer,input){const voice=DIMENSION_VOICE[layer==='core'?'evolution':layer==='impact'?'space':layer]||DIMENSION_VOICE.being;const p=firstPlacement();return [voice,p?.gate?`Gate ${p.gate}`:'',input?`— ${input}`:''].filter(Boolean).join(' ');}
 async function generate({input,layer,context,history}){
   const before=core.snapshot();
   core.transition('synthia',{cause:'message_received',statePatch:{lastInput:input,lastLayer:layer,messageCount:(history?.length||0)+1},activeSayings:{[layer]:composeStateSentence(layer,input)}});
   const lower=String(input).toLowerCase(); let response='';
   if(/who are you|what are you/.test(lower)) response='I am Synthia. My live body is wired to addressed state, training history, the Human Design research engine, and mandatory State Space / ATO / Klein cognition in the full host runtime.';
   else if(/research|experiment|hypothesis|test/.test(lower)){const q=core.ask(input,{address:core.entities.get('synthia')?.currentAddressKey}); response=`Scientist loop opened question ${q.id}.`}
   else if(/human design|chart|gate|authority|profile|transit|sidereal|draconic/.test(lower)&&chartBundle){const t=chartBundle.frames?.tropical;response=`HD research chart loaded. Tropical ${t?.type||''} ${t?.profile||''}; Tropical/Sidereal/Draconic frames are available with canonical addresses and timing.`;}
   else response=`${composeStateSentence(layer,input)}\n\nI registered this interaction at my current addressed state.`;
   const after=core.snapshot(); core.recordTraining({task:'conversation',stateBefore:before.entities.find(e=>e.entityId==='synthia')?.state||{},toolPath:['mobile-router','state-registry',chartBundle?'hd-research-v3':'local-reasoner'],interaction:{input,layer,context},stateAfter:after.entities.find(e=>e.entityId==='synthia')?.state||{},observedExpression:response,success:true,score:1});
   return response;
 }
 function onEvent(event){const current=core.entities.get('synthia');core.transition('synthia',{cause:event.type||'ui_event',statePatch:{lastEvent:event.type,eventAt:event.timestamp},toAddress:event.address||current?.currentAddress});}
 function getHumanDesignData(){if(!chartBundle)return null;const t=chartBundle.frames?.tropical;return {chart:t,bundle:chartBundle,gates:(t?.placements||[]).map(p=>({number:p.gate,gate:p.gate,name:p.gateName})),addresses:(t?.placements||[]).map(p=>p.canonicalAddress||p.address).filter(Boolean),capabilities:HD_CAPABILITIES,stellarInput:toStellarInput(t||chartBundle)};}
 async function executeArtifact(artifact,context={}){
   const before=core.entities.get('synthia');
   try{
     const result=await runtime.executeArtifact(artifact,{...context,source:context.source||'mobile-runtime-ui'});
     const mobileAddress=toMobileAddress(result.canonicalAddress||{});
     core.transition('synthia',{
       cause:'artifact_execution',
       toAddress:mobileAddress,
       statePatch:{
         lastExecution:{
           name:artifact?.name??artifact?.originalName??null,
           ok:Boolean(result.ok),
           path:result.path??null,
           canonicalAddressKey:result.canonicalAddressKey??null,
           foldHash:result.pipeline?.fold?.foldHash??null,
           cacheHit:Boolean(result.pipeline?.cache?.analysisHit),
           stageCount:result.pipeline?.stages?.length??0,
         },
       },
     });
     const after=core.entities.get('synthia');
     core.recordTraining({
       task:'artifact-execution',
       stateBefore:before?.state||{},
       toolPath:['mobile-runtime-ui','execution-spine',result.path||'unknown'],
       interaction:{name:artifact?.name??artifact?.originalName??null,type:artifact?.type??null,byteLength:artifact?.bytes?.length??null},
       stateAfter:after?.state||{},
       observedExpression:{ok:Boolean(result.ok),canonicalAddressKey:result.canonicalAddressKey??null,foldHash:result.pipeline?.fold?.foldHash??null},
       success:Boolean(result.ok),
       error:result.ok?null:(result.error??result.result?.error??'execution failed'),
       score:result.ok?1:0,
     });
     return result;
   }catch(error){
     core.transition('synthia',{cause:'artifact_execution_error',statePatch:{lastExecutionError:String(error?.message||error)}});
     core.recordTraining({task:'artifact-execution',stateBefore:before?.state||{},toolPath:['mobile-runtime-ui','execution-spine'],interaction:{name:artifact?.name??null},stateAfter:core.entities.get('synthia')?.state||{},observedExpression:null,success:false,error:String(error?.message||error),score:0});
     throw error;
   }
 }
 function executionSnapshot(){return runtime.executionSnapshot();}
 return {core,runtime,generate,onEvent,setBirthData,getHumanDesignData,executeArtifact,executionSnapshot,snapshot:()=>core.snapshot()};
}
