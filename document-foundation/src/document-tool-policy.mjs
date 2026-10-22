// Versioned descendant adapter. Donor files remain unchanged for audit.
// Keep dictionary storage additive to the native learner. Policy versions are
// retained only to replay already-landed journal entries without rewriting them.
export function installDocumentToolPolicy(engine) {
  const dictionary=new Map(),receipts=[],observations=[];
  const tool=engine.toolsById.get('diseminer');
  if(!tool)throw new Error('Missing mounted DISEMINER');
  const originalImplementation=tool.implementation;
  tool.implementation=(input={},wrapper={})=>{
    const probe=wrapper.context?.klein===true||wrapper.context?.kleinJoint===true;
    const nativeLearning=wrapper.context?.toolPolicyVersion==='native-learning.v3';
    const nativeContact=wrapper.context?.toolPolicyVersion==='native-text-contact.v2';
    const operation=input.operation??'observe';
    if(['simulate','narrate'].includes(operation))return {ok:false,status:'UNAVAILABLE',reason:'Legacy narrative persuasion is excluded by Locked Architecture §4',policy:'dictionary-contact.v1'};
    if(nativeContact&&!['observe','extract','query','stats'].includes(operation))return {ok:false,status:'UNAVAILABLE',operation,reason:'Unsupported dictionary/contact operation',policy:'native-text-contact.v2'};
    const entries=input.entries??[];
    if(input.observation&&(!input.observation.source_ref||!input.observation.modality))throw new TypeError('Native observation requires source_ref and modality');
    if(!Array.isArray(entries))throw new TypeError('Dictionary entries must be an array');
    for(const entry of entries)if(typeof entry.term!=='string'||!entry.term||typeof entry.definition!=='string'||!entry.source)throw new TypeError('Dictionary entries require term, definition, source');
    if(nativeLearning){
      if(!['observe','extract','query','stats'].includes(operation))return {ok:false,status:'UNAVAILABLE',operation,policy:'native-learning.v3',reason:'Unsupported dictionary/contact operation'};
      let native=null;
      if(operation==='stats'||(['observe','extract'].includes(operation)&&input.text!==undefined))native=originalImplementation(input,wrapper);
      else if(operation!=='query'&&!entries.length&&!input.observation)throw new TypeError(`${operation} requires text, dictionary entries, or an observation`);
      if(!probe)for(const entry of entries){const history=dictionary.get(entry.term)??[];dictionary.set(entry.term,[...history,structuredClone(entry)]);}
      if(!probe&&input.observation)observations.push(structuredClone(input.observation));
      const definitions=input.term?structuredClone(dictionary.get(input.term)??[]):[];
      const receipt={...(native??{}),policy:'native-learning.v3',operation,definitions,entryCount:dictionary.size,observationCount:observations.length,claims:native?.claims??[],status:native||definitions.length||entries.length||input.observation?'OBSERVED':'INVESTIGATE',...(native?{native}:{})};
      if(!probe)receipts.push(structuredClone(receipt));
      return receipt;
    }
    // Restore the donor's actual distributional observation. No new learner or
    // lexical rules are introduced. Older journal contexts retain v1 behavior.
    let native=null;
    if(nativeContact&&((operation==='observe'&&input.text!==undefined)||operation==='stats'))native=originalImplementation(input,wrapper);
    if(!probe)for(const entry of entries){const history=dictionary.get(entry.term)??[];dictionary.set(entry.term,[...history,structuredClone(entry)]);}
    if(!probe&&input.observation)observations.push(structuredClone(input.observation));
    const definitions=input.term?structuredClone(dictionary.get(input.term)??[]):[];
    const receipt={policy:'dictionary-contact.v1',operation,definitions,entryCount:dictionary.size,observationCount:observations.length,claims:[],status:definitions.length||entries.length||input.observation||native?'OBSERVED':'INVESTIGATE',reason:'Native observations and explicit sourced definitions retained; no narrative or inferred dictionary facts',...(native?{native,contactVersion:'native-text-contact.v2'}:{})};
    if(!probe)receipts.push(structuredClone(receipt));
    return receipt;
  };
  const previous=engine.contactLoop.deep.run.bind(engine.contactLoop.deep);
  engine.contactLoop.deep.run=(input={},context={})=>{
    if(context.toolPolicyVersion==='native-learning.v3'){
      // Capture the existing loop's real invocations; do not introduce another
      // fixed tool sequence or repeat AUTOLING's learning pass.
      const invocations=[],saved=[];
      for(const tool of engine.mesh.automata.values()){
        const run=tool.run;
        saved.push([tool,run]);
        tool.run=function(value,ctx){invocations.push({toolId:this.id,input:structuredClone(value)});return run.call(this,value,ctx);};
      }
      let result;
      try{result=previous(input,context);}finally{for(const [tool,run] of saved)tool.run=run;}
      const kleinEvaluation=engine.klein.evaluate({nodeId:context.source??'contact',eventType:'language-contact',invocations,address:context.operationalAddress??context.address??null,dimension:context.dimension??context.operationalAddress?.dimension??null,meshState:context.fieldMeaning??null,context});
      return {...result,kleinEvaluation,documentRouting:{policy:'native-learning.v3',order:invocations.map(call=>call.toolId),legacyNarrativeEnabled:false}};
    }
    const text=String(input.text??input.message??'');
    const routed=engine.toolsById.get('autoling').run({operation:'pipeline',text},context).output;
    const result=previous(input,context);
    return {...result,documentRouting:{policy:'dictionary-contact.v1',order:['MESSY/intake','AUTOLING','DISEMINER dictionary','remaining local tools'],speakerDimension:context.dimension??'UNKNOWN',dimensionRuleStatus:'INVESTIGATE',autoling:routed,legacyNarrativeEnabled:false}};
  };
  return {version:'native-learning.v3',dictionary,receipts,observations,audit:()=>({version:'native-learning.v3',entries:dictionary.size,receipts:receipts.length,observations:observations.length,legacyNarrativeEnabled:false,historicalAlgorithmVerified:false})};
}
