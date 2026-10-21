import { SynthiaGenerativeAssembly } from '../src/synthia-generative-assembly.mjs';
const address=(id,gate)=>({id,planetary:1,dimension:'Movement',gate,line:1,color:1,tone:1,base:1,degree:{band:1,subdivision:1,structure:'5-of-29'},minute:0,second:0,arcAxis:{arcUnit:1,axis:'Vertical'},zodiac:1,house:1,active:true,phase:0,amplitude:1,coherence:1});
const root=new SynthiaGenerativeAssembly({morphologyAddresses:[address('gate-3',3),address('gate-60',60)]});
const chat=await root.chat('Show me what is active in the field.');
const research=root.research({operation:'create',title:'Field inquiry',question:'What is active?'});
console.log(JSON.stringify({audit:root.wiringAudit(),chat:{utterance:chat.utterance,morphology:chat.morphology.inward.summary},research:{toolId:research.toolId,morphology:research.morphology.inward.summary}},null,2));
