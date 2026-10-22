// Explicit vocabulary from the final recap of document 1pRXTJGn5gwZvYuX2NQwKinM72HM2pU8arUS7KKK-nh0.
// These identities do not infer relationships; placements require sourced occurrences.
export const STRUCTURAL_IDENTITIES=Object.freeze(Object.fromEntries([
 ['Space','Form','WHO','Axon'],['Evolution','Gravity','WHAT','Axion'],
 ['Being','Matter','WHERE','Arc-second'],['Movement','Energy','WHEN','Axiom'],
 ['Design','Structure','WHY','Axis']
].map(([dimension,nature,question,role])=>[dimension,Object.freeze({dimension,nature,question,role})])));
export const BEING_READ_ORDER=Object.freeze(['Being','Movement','Space','Design','Evolution']);
export class StructuralFrames {
 constructor(snapshot){this.things=new Map(snapshot?.things??[]);this.occurrences=structuredClone(snapshot?.occurrences??[]);}
 define({id,dimension,source}){
  if(typeof id!=='string'||!id||!STRUCTURAL_IDENTITIES[dimension]||!source)throw new TypeError('Identity requires id, established dimension and source');
  if(this.things.has(id))throw new Error('Identity already established');
  const thing={id,identity:{...STRUCTURAL_IDENTITIES[dimension]},source};this.things.set(id,structuredClone(thing));return structuredClone(thing);
 }
 place({id,dominatingStructure,role,source}){
  if(!this.things.has(id)||!this.things.has(dominatingStructure)||!source)throw new TypeError('Placement requires two known structures and source');
  if(!Object.values(STRUCTURAL_IDENTITIES).some(x=>x.role===role))throw new TypeError('Unknown structural position');
  const occurrence={occurrence:this.occurrences.length+1,id,dominatingStructure,role,source};
  this.occurrences.push(structuredClone(occurrence));return this.read({id});
 }
 read({id}){
  if(!this.things.has(id))throw new Error('Unknown structure');
  const history=this.occurrences.filter(x=>x.id===id);
  return structuredClone({...this.things.get(id),currentPlacement:history.at(-1)??null,history});
 }
 enter({id}){
  const thing=this.read({id});
  // A moved constituent remains in history but is not a current child.
  const contents=[...this.things.keys()].map(id=>this.read({id})).filter(x=>x.currentPlacement?.dominatingStructure===id);
  return {dominatingStructure:thing,contents,readOrder:thing.identity.dimension==='Being'?[...BEING_READ_ORDER]:null};
 }
 snapshot(){return structuredClone({things:[...this.things],occurrences:this.occurrences});}
}
