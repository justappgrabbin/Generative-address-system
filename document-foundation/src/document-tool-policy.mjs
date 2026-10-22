// Versioned descendant adapter. Donor files remain unchanged for audit.
// Implements only explicit dictionary storage/query contracts, without claiming
// a faithful reproduction of Klein's 1966 algorithm (primary source still needed).
export function installDocumentToolPolicy(engine) {
  const dictionary=new Map(),receipts=[],observations=[];
  const tool=engine.toolsById.get('diseminer');
  if(!tool)throw new Error('Missing mounted DISEMINER');
  tool.implementation=(input={},wrapper={})=>{
    const probe=wrapper.context?.klein===true||wrapper.context?.kleinJoint===true;
    const operation=input.operation??'observe';
    if(['simulate','narrate'].includes(operation))return {ok:false,status:'UNAVAILABLE',reason:'Legacy narrative persuasion is excluded by Locked Architecture §4',policy:'dictionary-contact.v1'};
    const entries=input.entries??[];
    if(input.observation&&(!input.observation.source_ref||!input.observation.modality))throw new TypeError('Native observation requires source_ref and modality');
    if(!Array.isArray(entries))throw new TypeError('Dictionary entries must be an array');
    for(const entry of entries)if(typeof entry.term!=='string'||!entry.term||typeof entry.definition!=='string'||!entry.source)throw new TypeError('Dictionary entries require term, definition, source');
    if(!probe)for(const entry of entries){const history=dictionary.get(entry.term)??[];dictionary.set(entry.term,[...history,structuredClone(entry)]);}
    if(!probe&&input.observation)observations.push(structuredClone(input.observation));
    const definitions=input.term?structuredClone(dictionary.get(input.term)??[]):[];
    const receipt={policy:'dictionary-contact.v1',operation,definitions,entryCount:dictionary.size,observationCount:observations.length,claims:[],status:definitions.length||entries.length||input.observation?'OBSERVED':'INVESTIGATE',reason:'Native observations and explicit sourced definitions retained; no narrative or inferred dictionary facts'};
    if(!probe)receipts.push(structuredClone(receipt));
    return receipt;
  };
  const previous=engine.contactLoop.deep.run.bind(engine.contactLoop.deep);
  engine.contactLoop.deep.run=(input={},context={})=>{
    const text=String(input.text??input.message??'');
    const routed=engine.toolsById.get('autoling').run({operation:'pipeline',text},context).output;
    const result=previous(input,context);
    return {...result,documentRouting:{policy:'dictionary-contact.v1',order:['MESSY/intake','AUTOLING','DISEMINER dictionary','remaining local tools'],speakerDimension:context.dimension??'UNKNOWN',dimensionRuleStatus:'INVESTIGATE',autoling:routed,legacyNarrativeEnabled:false}};
  };
  return {version:'dictionary-contact.v1',dictionary,receipts,observations,audit:()=>({version:'dictionary-contact.v1',entries:dictionary.size,receipts:receipts.length,observations:observations.length,legacyNarrativeEnabled:false,historicalAlgorithmVerified:false})};
}
