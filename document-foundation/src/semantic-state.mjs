import {parseAddress,serializeAddress} from './operational-address.mjs';
const copy=structuredClone;
const textKey=text=>{if(typeof text!=='string'||!text.trim())throw new TypeError('Nonempty semantic term required');return text.normalize('NFC').trim().replace(/\s+/gu,' ');};
function rootKey(address){const a=JSON.parse(serializeAddress(address));delete a.dimension;return JSON.stringify(a);}
function refKey(ref){
  if(ref?.kind==='root')return JSON.stringify({coordinate:rootKey(ref.coordinate),revision:ref.revision});
  if(ref?.kind==='composition')return JSON.stringify({owner:refKey(ref.owner),program:ref.program,operands:ref.operands.map(refKey),...(ref.dominatingStructure?{dominatingStructure:ref.dominatingStructure}:{})});
  throw new TypeError('Invalid addressed representation reference');
}
// Learned, provenance-bearing semantics within the shared field. No intrinsic
// word→gate, color→tone or chart/arc formula is asserted by this mechanism.
export class SemanticState {
  constructor(snapshot){this.roots=new Map();this.derived=new Map();this.bySource=new Map();this.teaching=[];this.programs=new Map();if(snapshot)this.restore(snapshot);}
  attach({coordinate,representation,source,provenance}){
    coordinate=parseAddress(coordinate,provenance);
    if(!source||!provenance?.source)throw new TypeError('Representation requires source and calculation provenance');
    if(this.bySource.has(source))throw new Error('Source representation already landed');
    const key=rootKey(coordinate),history=this.roots.get(key)??[],ref={kind:'root',coordinate,revision:history.length+1};
    history.push({ref:copy(ref),representation:copy(representation),source,provenance:copy(provenance)});this.roots.set(key,history);this.bySource.set(source,ref);return copy(ref);
  }
  read(ref){
    let record;
    if(ref?.kind==='root'){parseAddress(ref.coordinate);record=this.roots.get(rootKey(ref.coordinate))?.[ref.revision-1];}
    else if(ref?.kind==='composition')record=this.derived.get(refKey(ref));
    if(!record)throw new Error('Unknown addressed representation');
    return copy(record);
  }
  refFor(source){return copy(this.bySource.get(source)??null);}
  teach({ref,term,source,context={}}){
    this.read(ref);if(!source)throw new TypeError('Semantic teaching requires evidence source');
    const record={id:`semantic-evidence:${this.teaching.length+1}`,ref:copy(ref),term:textKey(term),source,...(Object.keys(context).length?{context:copy(context)}:{})};this.teaching.push(record);return copy(record);
  }
  resolve(terms,{dimension,dominatingStructure}={}){
    if(!Array.isArray(terms)||!terms.length||terms.length>64)throw new TypeError('One to 64 semantic terms required');
    const latest=new Map();for(const record of this.teaching)latest.set(JSON.stringify([refKey(record.ref),record.context?.dominatingStructure??null]),record);
    const matches=terms.map(term=>{
      const key=textKey(typeof term==='string'?term:term.text);
      const candidates=[...latest.values()].filter(record=>record.term===key&&(!dimension||this.owner(record.ref).dimension===dimension)&&(dominatingStructure===undefined||record.context?.dominatingStructure===dominatingStructure));
      const selected=typeof term==='object'&&term.ref?candidates.filter(c=>refKey(c.ref)===refKey(term.ref)):candidates;
      return {term:key,candidates:copy(candidates),selected:selected.length===1?copy(selected[0]):null,status:selected.length===1?'RESOLVED':selected.length?'AMBIGUOUS':'UNKNOWN'};
    });
    return {status:matches.every(m=>m.selected)?'RESOLVED':'INVESTIGATE',matches,method:'sourced-semantic-evidence.v1',casePolicy:'Preserve capitalization; no invented morphology or synonym rules'};
  }
  owner(ref){return ref.kind==='root'?copy(ref.coordinate):this.owner(ref.owner);}
  learnProgram({name,owner,template,source,evidence}){
    this.read(owner);name=textKey(name);
    if(!source||!Array.isArray(evidence)||!evidence.length||!Array.isArray(template?.slots)||!template.slots.length||template.slots.length>64)throw new TypeError('Learned construction requires observed slots and source evidence');
    const versions=this.programs.get(name)??[];
    const program={name,version:versions.length+1,owner:copy(owner),template:copy(template),source,evidence:copy(evidence),status:'OBSERVED_CONSTRUCTION'};
    versions.push(program);this.programs.set(name,versions);return copy(program);
  }
  plan({program:name,terms,dimension,version,dominatingStructure}){
    const versions=this.programs.get(textKey(name)),program=version?versions?.[version-1]:versions?.at(-1);
    if(!program)return {status:'INVESTIGATE',reason:'No learned construction program',program:name};
    const resolution=this.resolve(terms,{dimension,dominatingStructure});
    if(terms.length!==program.template.slots.length)return {status:'INVESTIGATE',reason:'Term count differs from observed construction slots',expected:program.template.slots.length,resolution};
    if(resolution.status!=='RESOLVED')return {status:'INVESTIGATE',reason:'Unknown or ambiguous terms require evidence',resolution};
    const operands=resolution.matches.map(m=>m.selected.ref);
    const address={kind:'composition',owner:copy(program.owner),program:{name:program.name,version:program.version},operands:copy(operands),...(dominatingStructure?{dominatingStructure}:{})};
    return {status:'PLANNED',address,program:copy(program),operands:operands.map(ref=>this.read(ref)),resolution,dimension:dimension??null};
  }
  land({plan,representation,source,provenance}){
    if(plan?.status!=='PLANNED'||!source||!provenance?.source)throw new TypeError('A resolved plan and provenance are required');
    const key=refKey(plan.address),prior=this.derived.get(key);
    if(prior){if(JSON.stringify(prior.representation)!==JSON.stringify(representation))throw new Error('Landed construction changed; learn a new program version');this.bySource.set(source,copy(plan.address));return {address:copy(plan.address),witnessedAgain:true};}
    const record={ref:copy(plan.address),representation:copy(representation),source,provenance:copy(provenance),evidence:copy(plan.resolution),program:copy(plan.program)};
    this.derived.set(key,record);this.bySource.set(source,copy(plan.address));return {address:copy(plan.address),witnessedAgain:false};
  }
  snapshot(){return copy({roots:[...this.roots],derived:[...this.derived],bySource:[...this.bySource],teaching:this.teaching,programs:[...this.programs]});}
  restore(s){this.roots=new Map(copy(s.roots));this.derived=new Map(copy(s.derived));this.bySource=new Map(copy(s.bySource));this.teaching=copy(s.teaching);this.programs=new Map(copy(s.programs));return this;}
  audit(){return {addressedRoots:this.roots.size,derivedStates:this.derived.size,teachingEvents:this.teaching.length,constructionFamilies:this.programs.size,arcDerivation:'EXACT_SUBDIVISION_FROM_SUPPLIED_ORIGIN',contextualSemanticAssignment:'SOURCED_EVIDENCE_REQUIRED',semanticAssignment:'LEARNED_FROM_SOURCED_EVIDENCE'};}
}
