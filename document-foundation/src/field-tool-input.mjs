// Source-backed adapters select values already owned by the field. They do not
// invent lexical relationships, synthesize feature values, or use donor gates.
export function resolveFieldToolInput(field,request,rawInput={}){
 const {terms,dimension,dominatingStructure,bindings,source,version}=request??{};
 if(!source||!version||!bindings||typeof bindings!=='object'||Array.isArray(bindings))throw new TypeError('Meaning handoff requires sourced, versioned input bindings');
 const meaning=field.resolveMeaning({terms,dimension,dominatingStructure});
 if(meaning.status!=='RESOLVED')return {status:'INVESTIGATE',meaning};
 const input=structuredClone(rawInput),evidence=[];
 for(const [target,binding] of Object.entries(bindings)){
  if(['__proto__','constructor','prototype'].includes(target)||!Number.isInteger(binding.operand)||binding.operand<0||binding.operand>=meaning.operands.length||!Array.isArray(binding.path)||!binding.path.length)throw new TypeError('Invalid field-to-tool input binding');
  const operand=meaning.operands[binding.operand];let value=operand.state;
  for(const key of binding.path){
   if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||value==null||!Object.hasOwn(value,key))return {status:'INVESTIGATE',reason:'Field state does not contain the requested tool input',target,binding:structuredClone(binding),meaning};
   value=value[key];
  }
  input[target]=structuredClone(value);
  evidence.push({target,ref:operand.state.ref,path:[...binding.path],stateSource:operand.state.source,teachingSource:operand.teaching.source});
 }
 if(!evidence.length)throw new TypeError('At least one consumed field value is required');
 return {status:'RESOLVED',input,meaning,evidence,source,version};
}
